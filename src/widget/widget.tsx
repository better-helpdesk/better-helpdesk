import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Locale } from '../config';
import { type Api, createApi, uploadToStorage, useResource } from '../ui/api';
import { CodeBlock } from '../ui/code-block';
import {
  nextWorkday,
  relativeTime,
  type Translate,
  translator,
} from '../ui/i18n';
import { plainText, RichText } from '../ui/rich';
import { RichEditor, type RichEditorHandle } from '../ui/rich-editor';
import { captureScreen, Redactor } from './redact';

export type WidgetEvent =
  | { name: 'helpdesk:open' }
  | {
      name: 'helpdesk:message-sent';
      detail: {
        inbox: string;
        type: string;
        segment?: string;
        reference: string;
      };
    }
  | { name: 'helpdesk:booking-clicked'; detail: { reference: string } };

export type WidgetProps = {
  api: string;
  inbox: string;
  locale: Locale;
  /** Types offered; defaults to what the server allows. */
  types?: string[];
  /** Host context attached to new reports, e.g. `{ control: 'A.5.1' }`. */
  hostContext?: Record<string, string>;
  orgId?: string;
  /** Signed by the host for its signed-in user; see `identityTokenSecret`. */
  identityToken?: string;
  appVersion?: string;
  /** Text beside the launcher icon, e.g. "Questions? Write to us". */
  label?: string;
  errors: () => string[];
  onEvent?: (event: WidgetEvent) => void;
};

type Summary = {
  id: string;
  reference: string;
  subject: string | null;
  type: string;
  status: string;
  own: boolean;
  unread: boolean;
  sharedWithCompany: boolean;
  lastMessageAt: string;
  preview: string | null;
  rating?: 'good' | 'bad' | null;
  merged?: boolean;
};

type Session = {
  identified: boolean;
  name: string | null;
  email: string | null;
  orgs: { id: string; name: string }[];
  types: string[];
  help: boolean;
  team: { name: string; initials: string; avatarUrl: string | null }[];
  teamName?: string | null;
  awayUntil?: string | null;
  /** Set while an inbox with hours is closed or its team away. */
  nextOpening?: string | null;
  agent?: { waiting: number; url: string } | null;
  confirmation?: string | null;
  inbox: {
    title: Partial<Record<Locale, string>> | null;
    replyPromise: Partial<Record<Locale, string>> | null;
    privacyUrl: string | null;
    bookingUrl: string | null;
    qualify: {
      label: Record<Locale, string>;
      options: { value: string; label: Record<Locale, string> }[];
    } | null;
  } | null;
  conversations: Summary[];
};

type View =
  | { name: 'home' }
  | { name: 'form'; type: string }
  | { name: 'list' }
  | { name: 'thread'; id: string };

// Keyed by API so two helpdesks on one origin keep separate visitors. The bare
// key is what earlier versions wrote, read once so nobody loses a conversation.
const VISITOR_KEY = 'helpdesk-visitor';
const visitorKey = (api: string) => `${VISITOR_KEY}:${api.replace(/\/$/, '')}`;
const LANDING_KEY = 'helpdesk-landing';
const REFERRER_KEY = 'helpdesk-referrer';

function storage(kind: 'local' | 'session') {
  try {
    return kind === 'local' ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

/** A reload or in-site navigation is not where the visit came from. */
function externalReferrer() {
  try {
    const ref = document.referrer;
    return ref && new URL(ref).origin !== location.origin ? ref : '';
  } catch {
    return '';
  }
}

/** The first page of this visit and its campaign parameters, for lead attribution. */
function attribution() {
  const store = storage('session');
  let landing = store?.getItem(LANDING_KEY) ?? null;
  if (!landing) {
    landing = location.href;
    store?.setItem(LANDING_KEY, landing);
    store?.setItem(REFERRER_KEY, externalReferrer());
  }
  const referrer = store ? store.getItem(REFERRER_KEY) : externalReferrer();
  const utm = Object.fromEntries(
    [...new URL(landing).searchParams].filter(([k]) => k.startsWith('utm_'))
  );
  return {
    landingPage: landing,
    ...(referrer ? { referrer } : {}),
    ...(Object.keys(utm).length ? { utm } : {}),
  };
}

const Icon = {
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  close: 'M18 6 6 18M6 6l12 12',
  back: 'M15 18l-6-6 6-6',
  more: 'M12 6v.01M12 12v.01M12 18v.01',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  camera:
    'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  clip: 'M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5',
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => typeof matchMedia === 'function' && matchMedia(query).matches
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const list = matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Keeps Tab inside the full-screen sheet on phones. */
function trapFocus(event: React.KeyboardEvent<HTMLElement>) {
  const focusable = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
    ),
  ].filter(el => !el.hasAttribute('disabled'));
  const first = focusable[0];
  const last = focusable.at(-1);
  const active = (event.currentTarget.getRootNode() as ShadowRoot)
    .activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first?.focus();
  }
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(date: string, locale: Locale, t: Translate) {
  return Date.now() - new Date(date).getTime() < 60_000
    ? t('time.justNow')
    : relativeTime(date, locale);
}

function Svg({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function awayPromise(
  t: Translate,
  locale: Locale,
  until: Date,
  who: string | undefined
) {
  const day = (d: Date) =>
    new Intl.DateTimeFormat(locale === 'de' ? 'de-CH' : 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(d);
  const values = { date: day(until), nextDay: day(nextWorkday(until)) };
  return who
    ? t('widget.awayNamed', { ...values, name: who })
    : t('widget.away', values);
}

function openingPromise(
  t: Translate,
  locale: Locale,
  opens: Date,
  who: string | undefined
) {
  const tag = locale === 'de' ? 'de-CH' : 'en-GB';
  const soon = opens.getTime() - Date.now() < 6 * 86_400_000;
  const values = {
    day: new Intl.DateTimeFormat(tag, {
      weekday: 'long',
      ...(soon ? {} : { day: 'numeric', month: 'long' }),
    }).format(opens),
    time: new Intl.DateTimeFormat(tag, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(opens),
  };
  return who
    ? t('widget.closedNamed', { ...values, name: who })
    : t('widget.closed', values);
}

export function Widget(props: WidgetProps) {
  const { locale, inbox, onEvent } = props;
  const t = useMemo(() => translator(locale), [locale]);
  const token = useRef(
    storage('local')?.getItem(visitorKey(props.api)) ??
      storage('local')?.getItem(VISITOR_KEY) ??
      null
  );
  const identityToken = useRef(props.identityToken);
  identityToken.current = props.identityToken;
  const api = useMemo(
    () =>
      createApi(
        props.api,
        (): Record<string, string> => ({
          ...(token.current ? { 'x-helpdesk-visitor': token.current } : {}),
          ...(identityToken.current
            ? { 'x-helpdesk-identity': identityToken.current }
            : {}),
        })
      ),
    [props.api]
  );
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ name: 'home' });
  const [menuOpen, setMenuOpen] = useState(false);
  // Closed, it only needs to notice a reply to a thread the team still holds,
  // or, for an agent, a customer who wrote in.
  const [awaitingTeam, setAwaitingTeam] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const session = useResource(
    () => api<Session>(`widget/session?inbox=${encodeURIComponent(inbox)}`),
    `session:${inbox}`,
    open || isAgent ? 60_000 : awaitingTeam ? 300_000 : undefined
  );
  useEffect(() => {
    setAwaitingTeam(
      Boolean(session.data?.conversations.some(c => c.status === 'open'))
    );
    setIsAgent(Boolean(session.data?.agent));
  }, [session.data]);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const data = session.data;
  const unread = data?.conversations.filter(c => c.unread).length ?? 0;
  const { refresh } = session;
  const refreshSession = useCallback(() => void refresh(), [refresh]);

  const offered = (props.types ?? data?.types ?? []).filter(type =>
    data ? data.types.includes(type) : true
  );
  const single = offered.length === 1 ? offered[0] : undefined;
  const home: View = single ? { name: 'form', type: single } : { name: 'home' };

  const close = useCallback(() => {
    setOpen(false);
    setMenuOpen(false);
    launcher.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    onEvent?.({ name: 'helpdesk:open' });
    panel.current
      ?.querySelector<HTMLElement>(
        '.rt-input, textarea, input, button.type, button.item'
      )
      ?.focus();
  }, [open, onEvent]);

  const title =
    view.name === 'form' && !single
      ? t(`type.${view.type}`)
      : view.name === 'thread'
        ? (data?.conversations.find(c => c.id === view.id)?.reference ?? '')
        : (data?.inbox?.title?.[locale] ??
          (single === 'lead' ? t('type.lead') : t('widget.title')));
  const soleResponder = data?.team.length === 1 ? data.team[0] : undefined;
  const who = soleResponder?.name ?? data?.teamName ?? undefined;
  const promise = data?.nextOpening
    ? openingPromise(t, locale, new Date(data.nextOpening), who)
    : data?.awayUntil
      ? awayPromise(t, locale, new Date(data.awayUntil), who)
      : (data?.inbox?.replyPromise?.[locale] ??
        (who
          ? t('widget.replyPromiseNamed', { name: who })
          : t('widget.replyPromise')));
  const mobile = useMediaQuery('(max-width: 480px)');

  useEffect(() => {
    // Remember where this visit started while the referrer is still the entry one.
    attribution();
  }, []);

  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, mobile]);
  const agentWaiting = data?.agent?.waiting ?? 0;
  const hasConversations = (data?.conversations.length ?? 0) > 0;
  const showBack = view.name === 'thread' || (view.name === 'form' && !single);
  const formType =
    view.name === 'form'
      ? view.type
      : view.name === 'home'
        ? single
        : undefined;

  return (
    <>
      {open && (
        <div
          ref={panel}
          className="panel"
          data-fit={view.name === 'home' || view.name === 'form' || undefined}
          role="dialog"
          aria-modal={mobile || undefined}
          aria-label={title}
          onKeyDown={e => {
            if (e.key === 'Escape' && !e.defaultPrevented) close();
            if (e.key === 'Tab' && mobile) trapFocus(e);
          }}>
          <div className="head">
            <div className="head-row">
              {showBack && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('widget.back')}
                  onClick={() =>
                    setView(view.name === 'thread' ? { name: 'list' } : home)
                  }>
                  <Svg d={Icon.back} />
                </button>
              )}
              <span className="head-title">{title}</span>
              {view.name === 'thread' && (
                <ThreadMenu
                  api={api}
                  t={t}
                  id={view.id}
                  canShare={(data?.orgs.length ?? 0) > 0}
                  open={menuOpen}
                  setOpen={setMenuOpen}
                  onChanged={refreshSession}
                  conversation={data?.conversations.find(c => c.id === view.id)}
                />
              )}
              <button
                type="button"
                className="icon-btn"
                aria-label={t('widget.close')}
                onClick={close}>
                <Svg d={Icon.close} />
              </button>
            </div>
            <div className="presence">
              {data && data.team.length > 0 && (
                <span className="avatars" aria-hidden="true">
                  {data.team.map(m =>
                    m.avatarUrl ? (
                      <img
                        key={m.name}
                        className="avatar"
                        src={m.avatarUrl}
                        alt=""
                      />
                    ) : (
                      <span key={m.name} className="avatar" title={m.name}>
                        {m.initials}
                      </span>
                    )
                  )}
                </span>
              )}
              <span>{promise}</span>
            </div>
          </div>
          {agentWaiting > 0 &&
            view.name !== 'thread' &&
            view.name !== 'form' &&
            data?.agent && (
              <a className="agent-note" href={data.agent.url}>
                <span className="agent-dot" aria-hidden="true" />
                <span className="agent-note-text">
                  {agentWaiting === 1
                    ? t('widget.agentWaitingOne')
                    : t('widget.agentWaiting', {
                        count: String(agentWaiting),
                      })}
                </span>
                <span className="agent-note-link">
                  {t('widget.agentOpenInbox')}
                </span>
              </a>
            )}
          {(view.name === 'home' || view.name === 'list' || single) &&
            view.name !== 'thread' &&
            hasConversations && (
              <Tabs
                t={t}
                current={view.name === 'list' ? 'list' : 'new'}
                unread={unread > 0}
                onChange={next =>
                  setView(next === 'list' ? { name: 'list' } : home)
                }
              />
            )}
          {!data && session.error && (
            <LoadFailed t={t} onRetry={refreshSession} />
          )}
          {data && view.name === 'home' && !single && (
            <div className="body" role="tabpanel">
              <div className="types">
                {offered.map(type => (
                  <button
                    key={type}
                    type="button"
                    className="type"
                    onClick={() => setView({ name: 'form', type })}>
                    <strong>{t(`type.${type}`)}</strong>
                    <small>{t(`typeHint.${type}`)}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          {data && formType && (
            <NewMessage
              {...props}
              type={formType}
              api={api}
              t={t}
              session={data}
              onToken={value => {
                token.current = value;
                storage('local')?.setItem(visitorKey(props.api), value);
              }}
              onCreated={(id, detail) => {
                onEvent?.({ name: 'helpdesk:message-sent', detail });
                refreshSession();
                setView({ name: 'thread', id });
              }}
            />
          )}
          {view.name === 'list' && (
            <div className="body" role="tabpanel">
              <div className="list">
                {[...(data?.conversations ?? [])]
                  .sort(
                    (a, b) =>
                      Number(b.status === 'pending') -
                      Number(a.status === 'pending')
                  )
                  .map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className={[
                        'item',
                        c.unread && 'unread',
                        c.status === 'pending' && 'your-turn-card',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setView({ name: 'thread', id: c.id })}>
                      <span className="item-top">
                        <strong>{c.subject ?? t(`type.${c.type}`)}</strong>
                        <span className="fine">
                          {timeAgo(c.lastMessageAt, locale, t)}
                        </span>
                      </span>
                      {c.preview && (
                        <span className="preview">{c.preview}</span>
                      )}
                      <span className="fine">
                        {c.reference} ·{' '}
                        <span
                          className={
                            c.status === 'pending' ? 'your-turn' : undefined
                          }>
                          {t(`status.${c.status}`)}
                        </span>
                        {!c.own && ` · ${t('thread.shared')}`}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
          {view.name === 'thread' && (
            <Thread
              api={api}
              apiBase={props.api.replace(/\/$/, '')}
              linkFiles={Boolean(data?.identified)}
              t={t}
              locale={locale}
              id={view.id}
              email={data?.email ?? null}
              bookingUrl={data?.inbox?.bookingUrl ?? null}
              confirmation={data?.confirmation ?? null}
              onBook={reference =>
                onEvent?.({
                  name: 'helpdesk:booking-clicked',
                  detail: { reference },
                })
              }
              onSeen={refreshSession}
            />
          )}
        </div>
      )}
      <button
        ref={launcher}
        type="button"
        className="launcher"
        aria-label={
          open
            ? t('widget.close')
            : `${props.label ?? t('widget.open')}${
                agentWaiting > 0
                  ? ` · ${t('widget.agentWaiting', { count: String(agentWaiting) })}`
                  : ''
              }`
        }
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close();
          } else {
            setView(home);
            setOpen(true);
          }
        }}>
        <Svg d={open ? Icon.close : Icon.chat} />
        {!open && props.label && <span>{props.label}</span>}
        {unread > 0 && <span className="badge">{unread}</span>}
        {!open && agentWaiting > 0 && (
          // Quiet on purpose: noticeable to the agent, not to a room watching a demo.
          <span className="agent-dot on-launcher" aria-hidden="true" />
        )}
      </button>
    </>
  );
}

function Tabs({
  t,
  current,
  unread,
  onChange,
}: {
  t: Translate;
  current: 'new' | 'list';
  unread: boolean;
  onChange: (tab: 'new' | 'list') => void;
}) {
  const tabs = ['new', 'list'] as const;
  return (
    <div
      className="tabs"
      role="tablist"
      onKeyDown={e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const next = current === 'new' ? 'list' : 'new';
        onChange(next);
        e.currentTarget
          .querySelector<HTMLElement>(`[data-tab="${next}"]`)
          ?.focus();
      }}>
      {tabs.map(tab => (
        <button
          key={tab}
          type="button"
          role="tab"
          data-tab={tab}
          aria-selected={current === tab}
          tabIndex={current === tab ? 0 : -1}
          onClick={() => onChange(tab)}>
          {tab === 'new' ? t('widget.new') : t('widget.messages')}
          {tab === 'list' && unread && <span className="unread-dot" />}
        </button>
      ))}
    </div>
  );
}

type PendingFile = { id: string; blob: Blob; name: string; url?: string };

const CONTEXT_KEYS = [
  'url',
  'title',
  'userAgent',
  'viewport',
  'locale',
  'appVersion',
] as const;

const TECHNICAL = new Set(['bug', 'feature', 'question']);

function NewMessage({
  api,
  t,
  session,
  inbox,
  type,
  hostContext,
  orgId,
  appVersion,
  errors,
  locale,
  onToken,
  onCreated,
}: Omit<WidgetProps, 'api'> & {
  api: Api;
  t: Translate;
  type: string;
  session: Session;
  onToken: (token: string) => void;
  onCreated: (
    id: string,
    detail: {
      inbox: string;
      type: string;
      segment?: string;
      reference: string;
    }
  ) => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const message = useRef<RichEditorHandle>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [segment, setSegment] = useState('');
  const [org, setOrg] = useState(
    orgId && session.orgs.some(o => o.id === orgId)
      ? orgId
      : (session.orgs[0]?.id ?? '')
  );
  const [share, setShare] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  // Set once the conversation exists, so a retry after a failed upload sends
  // only the files still pending, not the conversation again.
  const created = useRef<{ id: string; reference: string } | null>(null);
  const [redacting, setRedacting] = useState<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  // Once the conversation exists only the attachments are left to send.
  const [sent, setSent] = useState(false);
  const [help, setHelp] = useState<
    { title: string; url: string; excerpt?: string }[]
  >([]);
  const technical = TECHNICAL.has(type);
  // A bug or feature report is rarely formatted; the toolbar waits behind a toggle.
  const plain = type === 'bug' || type === 'feature';
  const [formatting, setFormatting] = useState(false);
  const qualify = session.inbox?.qualify;

  // Read once per form: the checkboxes refer to these entries, and the page
  // keeps recording new ones while the form is open.
  const [recent] = useState(errors);
  const context = useMemo(() => {
    return {
      url: location.href,
      title: document.title,
      userAgent: navigator.userAgent,
      viewport: `${innerWidth}×${innerHeight}`,
      // The language they wrote in, which is the one to answer in.
      locale,
      ...(appVersion ? { appVersion } : {}),
      ...(recent.length ? { errors: recent } : {}),
      ...(hostContext && Object.keys(hostContext).length
        ? { host: hostContext }
        : {}),
    };
  }, [recent, appVersion, hostContext, locale]);
  // Errors are page text the person never typed; each is shown and can go,
  // as `errors:<index>`.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const toggle = (key: string, kept: boolean) =>
    setExcluded(set => {
      const next = new Set(set);
      if (kept) next.delete(key);
      else next.add(key);
      return next;
    });
  const contextKeys = [...CONTEXT_KEYS, 'errors', 'host'].filter(
    key => context[key as keyof typeof context]
  );

  useEffect(() => {
    const q = (subject || body).trim();
    if (!session.help || !technical || q.length < 4) {
      setHelp([]);
      return;
    }
    const timer = setTimeout(() => {
      api<{ results: { title: string; url: string; excerpt?: string }[] }>(
        `widget/help?q=${encodeURIComponent(q.slice(0, 200))}&locale=${locale}`
      )
        .then(r => setHelp(r.results))
        .catch(() => setHelp([]));
    }, 500);
    return () => clearTimeout(timer);
  }, [subject, body, session.help, technical, api, locale]);

  const addFile = (blob: Blob, fileName: string) =>
    setFiles(list => [
      ...list,
      {
        id: crypto.randomUUID(),
        blob,
        name: fileName,
        url: blob.type.startsWith('image/')
          ? URL.createObjectURL(blob)
          : undefined,
      },
    ]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // The editor is not a form control, so an empty message is caught here.
    if (!body.trim()) {
      message.current?.focus();
      return;
    }
    setState('sending');
    try {
      const sent: Record<string, unknown> = technical ? {} : attribution();
      for (const key of contextKeys) {
        if (!technical && key !== 'url' && key !== 'locale') continue;
        if (key === 'errors') {
          const kept = (context.errors ?? []).filter(
            (_, i) => !excluded.has(`errors:${i}`)
          );
          if (kept.length) sent.errors = kept;
        } else if (!excluded.has(key)) {
          sent[key] = context[key as keyof typeof context];
        }
      }
      if (!created.current) {
        const result = await api<{
          conversation: { id: string; reference: string } | null;
          visitorToken?: string;
        }>('widget/conversations', {
          body: {
            inbox,
            type,
            subject: subject.trim() || undefined,
            body,
            context: sent,
            orgId: org || undefined,
            sharedWithCompany: share,
            segment: segment || undefined,
            ...(session.identified
              ? {}
              : { name: name || undefined, email, website }),
          },
        });
        if (result.visitorToken) onToken(result.visitorToken);
        if (!result.conversation) {
          setState('idle');
          return;
        }
        created.current = result.conversation;
        setSent(true);
      }
      const { id, reference } = created.current;
      for (const file of files) {
        const started = await api<{
          id: string;
          upload: { url: string; fields: Record<string, string> };
        }>(`widget/conversations/${id}/attachments`, {
          body: {
            filename: file.name,
            contentType: file.blob.type || 'application/octet-stream',
            size: file.blob.size,
          },
        });
        await uploadToStorage(started.upload, file.blob);
        await api(
          `widget/conversations/${id}/attachments/${started.id}/complete`,
          { body: {} }
        );
        setFiles(pending => pending.filter(f => f !== file));
      }
      onCreated(id, {
        inbox,
        type,
        segment: segment || undefined,
        reference,
      });
    } catch {
      setState('error');
    }
  }

  const messageLabel =
    type === 'lead' || type === 'bug'
      ? t(`form.message.${type}`)
      : t('form.message');

  return (
    <form
      className="form"
      onSubmit={submit}
      onPaste={event => {
        if (!technical) return;
        for (const item of event.clipboardData.items) {
          const file = item.getAsFile();
          if (file?.type.startsWith('image/')) {
            addFile(file, file.name || 'pasted.png');
          }
        }
      }}>
      <div className="body">
        <fieldset className="sent-fields" disabled={sent}>
          <div className="field">
            <div className="field-head">
              <span aria-hidden="true">{messageLabel}</span>
              {plain && (
                <button
                  type="button"
                  className="format-toggle"
                  aria-pressed={formatting}
                  onClick={() => setFormatting(on => !on)}>
                  {t('rich.toolbar')}
                </button>
              )}
            </div>
            <RichEditor
              ref={message}
              className="rt-form"
              label={messageLabel}
              placeholder={t(`form.placeholder.${type}`)}
              value={body}
              onChange={setBody}
              t={t}
              toolbar={!plain || formatting}
              readOnly={sent}
            />
          </div>
          {help.length > 0 && (
            <div className="box help">
              <span className="help-heading">{t('form.helpHeading')}</span>
              <ul>
                {help.map(h => (
                  <li key={h.url}>
                    <a href={h.url} target="_blank" rel="noreferrer">
                      <span className="help-title">{h.title}</span>
                      {h.excerpt && (
                        <span className="help-excerpt">{h.excerpt}</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!session.identified && (
            <>
              <label className="field">
                {t('form.workEmail')}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="field">
                {t('form.nameOptional')}
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px' }}
                value={website}
                onChange={e => setWebsite(e.target.value)}
              />
            </>
          )}
          {qualify && (
            <fieldset className="field choices">
              <legend>
                {qualify.label[locale]}{' '}
                <span className="hint">{t('form.optional')}</span>
              </legend>
              {qualify.options.map(o => (
                <label key={o.value} className="choice">
                  <input
                    type="radio"
                    name="support-segment"
                    value={o.value}
                    checked={segment === o.value}
                    onChange={() => setSegment(o.value)}
                  />
                  {o.label[locale]}
                </label>
              ))}
            </fieldset>
          )}
          {technical && (
            <label className="field">
              {t('form.subjectOptional')}
              <input
                type="text"
                maxLength={200}
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </label>
          )}
          {session.orgs.length > 1 && (
            <label className="field">
              {t('form.organization')}
              <select value={org} onChange={e => setOrg(e.target.value)}>
                {session.orgs.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {session.orgs.length > 0 && (
            <label className="switch">
              {t('form.share')}
              <input
                type="checkbox"
                role="switch"
                aria-checked={share}
                checked={share}
                onChange={e => setShare(e.target.checked)}
              />
            </label>
          )}
        </fieldset>
        {technical && (
          <>
            <div className="row">
              <button
                type="button"
                className="secondary"
                onClick={async () => {
                  try {
                    setRedacting(await captureScreen());
                  } catch {
                    // The user declined the browser's capture prompt.
                  }
                }}>
                <Svg d={Icon.camera} />
                {t('form.screenshot')}
              </button>
              <label className="secondary">
                <Svg d={Icon.clip} />
                {t('form.attach')}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain"
                  hidden
                  onChange={e => {
                    for (const file of e.target.files ?? []) {
                      addFile(file, file.name);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {files.length > 0 && (
              <div className="thumbs">
                {files.map(file => (
                  <div key={file.id} className="thumb">
                    {file.url ? (
                      <img src={file.url} alt={file.name} />
                    ) : (
                      <span>{file.name}</span>
                    )}
                    <button
                      type="button"
                      aria-label={t('form.remove')}
                      onClick={() =>
                        setFiles(list => list.filter(f => f.id !== file.id))
                      }>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {contextKeys.length > 0 && (
              <fieldset className="sent-fields" disabled={sent}>
                <details className="box context">
                  <summary>
                    {t('form.contextSummary', {
                      count: String(
                        contextKeys.filter(key =>
                          key === 'errors'
                            ? (context.errors ?? []).some(
                                (_, i) => !excluded.has(`errors:${i}`)
                              )
                            : !excluded.has(key)
                        ).length
                      ),
                    })}
                    <span className="muted">{t('form.review')}</span>
                  </summary>
                  <div className="box-body">
                    <span className="fine">{t('form.contextHint')}</span>
                    {contextKeys.map(key => {
                      const value = context[key as keyof typeof context];
                      if (key === 'errors') {
                        return (context.errors ?? []).map((error, i) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: the list is fixed while the form is open, and the index is what `excluded` keeps.
                          <label key={`error-${i}`} className="check">
                            <input
                              type="checkbox"
                              checked={!excluded.has(`errors:${i}`)}
                              onChange={e =>
                                toggle(`errors:${i}`, e.target.checked)
                              }
                            />
                            <span>
                              {t('context.errors')}:{' '}
                              <span className="context-value">{error}</span>
                            </span>
                          </label>
                        ));
                      }
                      const label =
                        key === 'host'
                          ? Object.keys(value as object).join(', ')
                          : t(`context.${key}`);
                      const shown = Array.isArray(value)
                        ? `${value.length}`
                        : typeof value === 'object'
                          ? Object.values(value as object).join(', ')
                          : String(value);
                      return (
                        <label key={key} className="check">
                          <input
                            type="checkbox"
                            checked={!excluded.has(key)}
                            onChange={e => toggle(key, e.target.checked)}
                          />
                          <span>
                            {label}:{' '}
                            <span className="context-value">{shown}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              </fieldset>
            )}
          </>
        )}
      </div>
      <div className="footer">
        {state === 'error' && (
          <p className="error" role="alert">
            {t(sent ? 'form.attachmentsError' : 'form.error')}
          </p>
        )}
        {!session.identified && session.inbox?.privacyUrl && (
          <p className="fine">
            {t('form.privacy')}{' '}
            <a href={session.inbox.privacyUrl} target="_blank" rel="noreferrer">
              {t('form.privacyLink')}
            </a>
          </p>
        )}
        <button
          type="submit"
          className="primary"
          disabled={state === 'sending'}>
          {state === 'sending' ? t('form.sending') : t('form.send')}
        </button>
      </div>
      {redacting && (
        <Redactor
          source={redacting}
          t={t}
          onCancel={() => setRedacting(null)}
          onDone={blob => {
            addFile(blob, 'screenshot.png');
            setRedacting(null);
          }}
        />
      )}
    </form>
  );
}

type ThreadData = {
  conversation: Summary;
  messages: {
    id: string;
    author: 'contact' | 'agent' | 'system';
    name: string | null;
    own: boolean;
    body: string;
    createdAt: string;
  }[];
  attachments: { id: string; filename: string }[];
};

function ThreadMenu({
  api,
  t,
  id,
  canShare,
  conversation,
  open,
  setOpen,
  onChanged,
}: {
  api: Api;
  t: Translate;
  id: string;
  canShare: boolean;
  conversation: Summary | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
  onChanged: () => void;
}) {
  if (!canShare || !conversation?.own) return null;
  return (
    <div className="menu">
      <button
        type="button"
        className="icon-btn"
        aria-label={t('widget.more')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <Svg d={Icon.more} />
      </button>
      {open && (
        <div className="menu-pop">
          <label className="switch">
            {t('form.share')}
            <input
              type="checkbox"
              role="switch"
              aria-checked={conversation.sharedWithCompany}
              checked={conversation.sharedWithCompany}
              onChange={async e => {
                await api(`widget/conversations/${id}`, {
                  method: 'PATCH',
                  body: { sharedWithCompany: e.target.checked },
                }).catch(() => {});
                onChanged();
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function Thread({
  api,
  apiBase,
  linkFiles,
  t,
  locale,
  id,
  email,
  bookingUrl,
  confirmation,
  onBook,
  onSeen,
}: {
  api: Api;
  apiBase: string;
  /** Only a cookie session can open a plain download link. */
  linkFiles: boolean;
  t: Translate;
  locale: Locale;
  id: string;
  email: string | null;
  bookingUrl: string | null;
  /** An agent-set text replacing the default confirmation. */
  confirmation: string | null;
  onBook: (reference: string) => void;
  onSeen: () => void;
}) {
  const thread = useResource(
    () => api<ThreadData>(`widget/conversations/${id}`),
    id,
    5000
  );
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveFailed, setResolveFailed] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const editor = useRef<RichEditorHandle>(null);
  const count = thread.data?.messages.length ?? 0;

  useEffect(() => {
    if (count === 0) return;
    end.current?.scrollIntoView({ block: 'end' });
    void api(`widget/conversations/${id}/seen`, { body: {} }).then(
      onSeen,
      () => {}
    );
  }, [count, id, api, onSeen]);

  const send = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    setFailed(false);
    try {
      await api(`widget/conversations/${id}/messages`, {
        body: { body: reply },
      });
      setReply('');
      await thread.refresh();
    } catch {
      // The draft stays in the box so a retry sends the same text.
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const resolve = async () => {
    setResolving(true);
    setResolveFailed(false);
    try {
      await api(`widget/conversations/${id}`, {
        method: 'PATCH',
        body: { status: 'resolved' },
      });
      await thread.refresh();
      // The resolve button is gone; without this, focus drops out of the phone sheet's trap.
      editor.current?.focus();
      onSeen();
    } catch {
      setResolveFailed(true);
    } finally {
      setResolving(false);
    }
  };

  const data = thread.data;
  if (!data) {
    return thread.error ? (
      <LoadFailed t={t} onRetry={() => void thread.refresh()} />
    ) : (
      <div className="body" />
    );
  }
  const answered = data.messages.some(m => m.author === 'agent');
  const typed = t(`thread.thanks.${data.conversation.type}`);
  // An unknown type falls back to its own key's last part.
  const thanks = typed === data.conversation.type ? t('thread.thanks') : typed;
  const subject = data.conversation.subject;
  // A derived subject is the first message cut short; the bubble below shows it whole.
  const typedSubject =
    subject &&
    !plainText(data.messages[0]?.body ?? '').startsWith(
      subject.replace(/…$/, '')
    )
      ? subject
      : null;
  // Before anyone answers, the header and the receipt notice already say what happens next.
  const status =
    answered || data.conversation.status === 'resolved'
      ? t(`status.${data.conversation.status}`)
      : null;

  return (
    <>
      <div className="body">
        {(typedSubject || status) && (
          <div>
            {typedSubject && (
              <strong className="subject">{typedSubject}</strong>
            )}
            {status && (
              <div
                className="strip"
                role="status"
                data-your-turn={
                  data.conversation.status === 'pending' || undefined
                }>
                {status}
              </div>
            )}
          </div>
        )}
        <div className="msgs">
          {data.messages.map((m, index) => (
            <Fragment key={m.id}>
              <div className={m.own ? 'msg-row mine' : 'msg-row theirs'}>
                {!m.own && m.author === 'agent' && (
                  <span className="avatar" aria-hidden="true">
                    {initialsOf(m.name ?? t('thread.support'))}
                  </span>
                )}
                <div className="msg">
                  <span className="msg-meta">
                    {m.own
                      ? t('thread.you')
                      : m.author === 'agent'
                        ? (m.name ?? t('thread.support'))
                        : m.name}{' '}
                    · {timeAgo(m.createdAt, locale, t)}
                  </span>
                  <RichText
                    text={m.body}
                    hosts={!m.own}
                    code={text => <CodeBlock text={text} t={t} />}
                  />
                </div>
              </div>
              {index === 0 && !answered && (
                <div className="notice" role="status">
                  <strong>{thanks}</strong>
                  <span>
                    {confirmation
                      ? confirmation
                          .replaceAll('{email}', email ?? '')
                          .replaceAll(
                            '{reference}',
                            data.conversation.reference
                          )
                      : email
                        ? t('thread.confirmEmail', {
                            email,
                            reference: data.conversation.reference,
                          })
                        : t('thread.confirmHere', {
                            reference: data.conversation.reference,
                          })}
                  </span>
                  {bookingUrl && (
                    <span className="book">
                      {t('thread.bookLead')}{' '}
                      <a
                        href={bookingUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => onBook(data.conversation.reference)}>
                        {t('thread.book')}
                      </a>
                    </span>
                  )}
                </div>
              )}
            </Fragment>
          ))}
        </div>
        {linkFiles && data.attachments.length > 0 && (
          <div className="files">
            {data.attachments.map(a => (
              <a
                key={a.id}
                href={`${apiBase}/widget/conversations/${id}/attachments/${a.id}/`}
                target="_blank"
                rel="noreferrer">
                {a.filename}
              </a>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        className="composer"
        onSubmit={event => {
          event.preventDefault();
          void send();
        }}>
        <RichEditor
          ref={editor}
          className="rt-reply"
          label={t('thread.reply')}
          placeholder={t('thread.reply')}
          value={reply}
          onChange={setReply}
          t={t}
          toolbar={false}
          onKeyDown={e => {
            // Enter sends; Shift+Enter breaks the line.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="submit"
          className="send"
          aria-label={failed ? t('thread.retry') : t('thread.send')}
          disabled={sending || !reply.trim()}>
          <Svg d={Icon.send} />
        </button>
      </form>
      {failed && (
        <p className="error composer-error" role="alert">
          {t('thread.failed')}
        </p>
      )}
      {data.conversation.own && data.conversation.status !== 'resolved' && (
        <div className="resolve">
          <button
            type="button"
            disabled={resolving}
            onClick={() => void resolve()}>
            {t('thread.resolve')}
          </button>
        </div>
      )}
      {resolveFailed && (
        <p className="error composer-error" role="alert">
          {t('thread.resolveFailed')}
        </p>
      )}
      {data.conversation.own &&
        (data.conversation.rating ? (
          <p className="fine rating-thanks" role="status">
            {t('rating.thanks')}
          </p>
        ) : (
          data.conversation.status === 'resolved' &&
          !data.conversation.merged && (
            <RatingPrompt
              t={t}
              onRate={async body => {
                await api(`widget/conversations/${id}/rating`, { body });
                await thread.refresh();
              }}
            />
          )
        ))}
    </>
  );
}

function LoadFailed({ t, onRetry }: { t: Translate; onRetry: () => void }) {
  return (
    <div className="body">
      <div className="notice notice-danger" role="alert">
        <span>{t('load.failed')}</span>
        <button type="button" className="secondary" onClick={onRetry}>
          {t('thread.retry')}
        </button>
      </div>
    </div>
  );
}

function RatingPrompt({
  t,
  onRate,
}: {
  t: Translate;
  onRate: (body: { rating: 'good' | 'bad'; comment: string }) => Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const rate = async (rating: 'good' | 'bad') => {
    setSending(true);
    setFailed(false);
    try {
      await onRate({ rating, comment });
    } catch {
      setFailed(true);
      setSending(false);
    }
  };
  return (
    <fieldset className="rating" disabled={sending}>
      <legend>{t('rating.question')}</legend>
      <textarea
        aria-label={t('rating.comment')}
        placeholder={t('rating.comment')}
        maxLength={2000}
        value={comment}
        onChange={e => setComment(e.target.value)}
      />
      <div className="rating-buttons">
        <button type="button" onClick={() => void rate('good')}>
          {t('rating.good')}
        </button>
        <button type="button" onClick={() => void rate('bad')}>
          {t('rating.bad')}
        </button>
      </div>
      {failed && (
        <p className="error" role="alert">
          {t('rating.failed')}
        </p>
      )}
    </fieldset>
  );
}
