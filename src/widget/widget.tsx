import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Locale, Translated } from '../config';
import {
  type Api,
  createApi,
  uploadToStorage,
  useEvents,
  useResource,
} from '../ui/api';
import { CodeBlock } from '../ui/code-block';
import {
  dateLocale,
  nextWorkday,
  relativeTime,
  type Translate,
  translated,
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

/** What a host passes to `open()`: the form, and text to start it with. */
export type OpenRequest = { type?: string; subject?: string; message?: string };

type Prefill = { subject?: string; message?: string };

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
  /** In the page itself: always open, no launcher, the conversations first. */
  inline?: boolean;
  /** Set anew by the host to open the panel, on the form of `type` when the inbox offers it. */
  openRequest?: OpenRequest;
  errors: () => string[];
  onEvent?: (event: WidgetEvent) => void;
};

type Summary = {
  id: string;
  reference: string;
  subject: string | null;
  type: string;
  kind?: 'chat' | 'ticket';
  status: string;
  own: boolean;
  unread: boolean;
  sharedWithCompany: boolean;
  lastMessageAt: string;
  preview: string | null;
  rating?: 'good' | 'bad' | null;
  merged?: boolean;
  agentSeenAt?: string | null;
  /** An agent is writing a reply right now. */
  typing?: boolean;
};

type Session = {
  identified: boolean;
  name: string | null;
  email: string | null;
  orgs: { id: string; name: string }[];
  types: string[];
  help: boolean;
  uploads: boolean;
  /** The server pushes changes over `widget/events`. */
  realtime?: boolean;
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
      label: Translated;
      options: { value: string; label: Translated }[];
    } | null;
  } | null;
  conversations: Summary[];
};

type View =
  | { name: 'home' }
  | { name: 'types' }
  | { name: 'form'; type: string; prefill?: Prefill; choices?: string[] }
  | { name: 'chat'; prefill?: Prefill }
  | { name: 'list' }
  | { name: 'help'; query: string }
  | { name: 'thread'; id: string };

// Keyed by API so two helpdesks on one origin keep separate visitors. The bare
// key is what earlier versions wrote, read once so nobody loses a conversation.
const VISITOR_KEY = 'helpdesk-visitor';
const visitorKey = (api: string) => `${VISITOR_KEY}:${api.replace(/\/$/, '')}`;
const SEARCHES_KEY = 'helpdesk-searches';
const LANDING_KEY = 'helpdesk-landing';
const REFERRER_KEY = 'helpdesk-referrer';

// Who a token names, read without verifying it: the server verifies every
// token. A refresh for the same person must not reload or remount anything.
function tokenSubject(token: string | undefined) {
  if (!token) return '';
  try {
    const body = token.split('.')[1] ?? '';
    const claims = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof claims.sub === 'string' ? claims.sub : token;
  } catch {
    return token;
  }
}

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
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  messages:
    'M17 8h2a2 2 0 0 1 2 2v10l-4-4h-6a2 2 0 0 1-2-2v-1M15 4H5a2 2 0 0 0-2 2v10l4-4h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  ticket:
    'M3 8V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v0a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4V8zM9 5v14',
  external:
    'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
};

/** What this browser searched the docs for last, newest first; per API, like the visitor. */
function recentSearches(api: string): string[] {
  try {
    const stored = JSON.parse(
      storage('local')?.getItem(`${SEARCHES_KEY}:${api}`) ?? '[]'
    );
    return Array.isArray(stored)
      ? stored.filter((q): q is string => typeof q === 'string')
      : [];
  } catch {
    return [];
  }
}

function rememberSearch(api: string, query: string) {
  const q = query.trim();
  if (q.length < 2) return;
  const next = [
    q,
    ...recentSearches(api).filter(s => s.toLowerCase() !== q.toLowerCase()),
  ].slice(0, 5);
  try {
    storage('local')?.setItem(`${SEARCHES_KEY}:${api}`, JSON.stringify(next));
  } catch {
    // Not remembered; the search worked all the same.
  }
}

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
    new Intl.DateTimeFormat(dateLocale(locale), {
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
  const tag = dateLocale(locale);
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
  const subject = tokenSubject(props.identityToken);
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
  const inline = Boolean(props.inline);
  const [open, setOpen] = useState(inline);
  const [view, setView] = useState<View>({ name: 'home' });
  const [menuOpen, setMenuOpen] = useState(false);
  // Closed, it only needs to notice a reply to a thread the team still holds,
  // or, for an agent, a customer who wrote in.
  const [awaitingTeam, setAwaitingTeam] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const session = useResource(
    () =>
      api<Session>(
        `widget/session?inbox=${encodeURIComponent(inbox)}&locale=${locale}`
      ),
    `session:${inbox}:${locale}:${subject}`,
    open || isAgent ? 60_000 : awaitingTeam ? 300_000 : undefined
  );
  useEffect(() => {
    setAwaitingTeam(
      Boolean(session.data?.conversations.some(c => c.status === 'open'))
    );
    setIsAgent(Boolean(session.data?.agent));
  }, [session.data]);
  // The open thread hears its own changes through this, the list through the session.
  const changes = useMemo(() => new EventTarget(), []);
  useEvents(
    api,
    'widget/events',
    Boolean(session.data?.realtime) && (open || awaitingTeam || isAgent),
    change => {
      void session.refresh();
      changes.dispatchEvent(new CustomEvent('change', { detail: change }));
    }
  );
  // A support page opens on the customer's conversations once there are any,
  // before Home's recent list can paint and take a click the switch would undo.
  const listed = useRef(false);
  useLayoutEffect(() => {
    if (!inline || listed.current || !session.data) return;
    listed.current = true;
    if (session.data.conversations.length > 0) setView({ name: 'list' });
  }, [inline, session.data]);
  // Another person's thread is not theirs to read, so a sign-in, sign-out or
  // switch of user leaves it for the list.
  const shownSubject = useRef(subject);
  useEffect(() => {
    if (shownSubject.current === subject) return;
    shownSubject.current = subject;
    setView(v => (v.name === 'thread' ? { name: 'list' } : v));
  }, [subject]);
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
  // A ticket reports a bug or asks for a feature; the form offers whichever the inbox takes.
  const ticketTypes = offered.filter(
    type => type === 'bug' || type === 'feature'
  );
  const ticket: View = ticketTypes[0]
    ? { name: 'form', type: ticketTypes[0], choices: ticketTypes }
    : offered.length === 1 && offered[0]
      ? { name: 'form', type: offered[0] }
      : { name: 'types' };
  // A message goes in as a question when the inbox takes questions.
  const chatType = offered.includes('question') ? 'question' : offered[0];
  // With one form there is no navigation, so an empty list would be a dead end.
  const emptyList =
    Boolean(single) &&
    view.name === 'list' &&
    data !== null &&
    data.conversations.length === 0;
  useEffect(() => {
    if (emptyList)
      setView(single ? { name: 'form', type: single } : { name: 'home' });
  }, [emptyList, single]);

  // A host's request waits for the session, which says what the inbox offers.
  const [requested, setRequested] = useState<{
    type: string;
    prefill: Prefill;
    wasOpen: boolean;
  } | null>(null);
  const focusForm = useRef(false);
  const isOpen = useRef(open);
  isOpen.current = open;
  useEffect(() => {
    if (!props.openRequest) return;
    const { type, subject, message } = props.openRequest;
    setRequested({
      type: type ?? '',
      prefill: { subject, message },
      wasOpen: isOpen.current,
    });
    setMenuOpen(false);
    setOpen(true);
  }, [props.openRequest]);
  const offeredKey = offered.join(',');
  useEffect(() => {
    if (requested === null || !data) return;
    setRequested(null);
    // An inbox with one form names it for the host.
    const type = requested.type || single || '';
    const offeredType = offeredKey.split(',').includes(type);
    // An open panel keeps what the customer is writing: only a form the host
    // names replaces it, and never a thread with its reply.
    if (requested.wasOpen && (!offeredType || view.name === 'thread')) return;
    focusForm.current = true;
    setView(
      offeredType
        ? { name: 'form', type, prefill: requested.prefill }
        : single
          ? { name: 'form', type: single, prefill: requested.prefill }
          : { name: 'home' }
    );
  }, [requested, data, offeredKey, single, view.name]);
  useEffect(() => {
    if (!focusForm.current || view.name !== 'form') return;
    focusForm.current = false;
    // The message is what a form is for, wherever the subject sits.
    const fields = panel.current;
    (
      fields?.querySelector<HTMLElement>('.rt-input') ??
      fields?.querySelector<HTMLElement>('textarea, input')
    )?.focus();
  }, [view]);

  const close = useCallback(() => {
    if (inline) return;
    setOpen(false);
    setMenuOpen(false);
    launcher.current?.focus();
  }, [inline]);

  useEffect(() => {
    // On a page it is not opened, so it neither announces that nor takes focus.
    if (!open || inline) return;
    onEvent?.({ name: 'helpdesk:open' });
    panel.current
      ?.querySelector<HTMLElement>(
        '.rt-input, textarea, input, button.type, button.item'
      )
      ?.focus();
  }, [open, inline, onEvent]);

  const title =
    view.name === 'form' && view.choices
      ? t('widget.submitTicket')
      : view.name === 'form' && !single
        ? t(`type.${view.type}`)
        : view.name === 'thread'
          ? (data?.conversations.find(c => c.id === view.id)?.reference ?? '')
          : view.name === 'chat'
            ? t('widget.sendMessage')
            : view.name === 'types'
              ? t('widget.submitTicket')
              : view.name === 'help'
                ? t('widget.docs')
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
    if (!open || !mobile || inline) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, mobile, inline]);
  const agentWaiting = data?.agent?.waiting ?? 0;
  const hasConversations = (data?.conversations.length ?? 0) > 0;
  const showBack =
    view.name === 'thread' ||
    view.name === 'chat' ||
    view.name === 'types' ||
    (view.name === 'form' && !single);
  const back: View =
    view.name === 'thread'
      ? { name: 'list' }
      : view.name === 'form' && !view.choices && offered.length > 1
        ? { name: 'types' }
        : home;
  const tab =
    view.name === 'list' || view.name === 'thread'
      ? 'messages'
      : view.name === 'help'
        ? 'help'
        : 'home';
  const showNav =
    !single &&
    data !== null &&
    (view.name === 'home' || view.name === 'list' || view.name === 'help');
  const formType =
    view.name === 'form'
      ? view.type
      : view.name === 'home'
        ? single
        : undefined;

  return (
    <>
      {open && (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-modal is set only when the role is dialog.
        // biome-ignore lint/a11y/noStaticElementInteractions: as a dialog it takes Escape and Tab; as a page region the handler does nothing.
        <div
          ref={panel}
          className="panel"
          // Only a single-form inbox fits its content; the tabbed panel keeps
          // one height, so it does not jump as the customer moves through it.
          data-fit={
            (single && (view.name === 'home' || view.name === 'form')) ||
            undefined
          }
          data-inline={inline || undefined}
          role={inline ? 'region' : 'dialog'}
          aria-modal={(!inline && mobile) || undefined}
          aria-label={title}
          onKeyDown={e => {
            if (e.key === 'Escape' && !e.defaultPrevented) close();
            if (e.key === 'Tab' && mobile && !inline) trapFocus(e);
          }}>
          <div className="head">
            <div className="head-row">
              {showBack && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('widget.back')}
                  onClick={() => setView(back)}>
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
              {!inline && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('widget.close')}
                  onClick={close}>
                  <Svg d={Icon.close} />
                </button>
              )}
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
          {single && view.name !== 'thread' && hasConversations && (
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
            <Home
              t={t}
              locale={locale}
              session={data}
              searches={recentSearches(props.api)}
              onSearch={query => setView({ name: 'help', query })}
              onChat={() => setView({ name: 'chat' })}
              onTicket={() => setView(ticket)}
              onOpen={id => setView({ name: 'thread', id })}
              onAll={() => setView({ name: 'list' })}
            />
          )}
          {data && view.name === 'types' && (
            <div className="body">
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
          {data && view.name === 'help' && (
            <HelpSearch
              api={api}
              t={t}
              locale={locale}
              query={view.query}
              onQuery={query => setView({ name: 'help', query })}
              onRemember={query => rememberSearch(props.api, query)}
              onAsk={query =>
                setView({
                  name: 'chat',
                  prefill: query.trim()
                    ? { message: `${query.trim()}: ` }
                    : undefined,
                })
              }
            />
          )}
          {data && view.name === 'chat' && chatType && (
            <NewMessage
              key="chat"
              {...props}
              type={chatType}
              kind="chat"
              prefill={view.prefill}
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
          {data && formType && (
            <NewMessage
              key={view.name === 'form' && view.choices ? 'ticket' : formType}
              {...props}
              type={formType}
              kind="ticket"
              typeChoices={view.name === 'form' ? view.choices : undefined}
              prefill={view.name === 'form' ? view.prefill : undefined}
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
          {view.name === 'list' && data?.conversations.length === 0 && (
            <div className="body empty">
              <Svg d={Icon.messages} />
              <strong>{t('widget.noConversations')}</strong>
              <span className="fine">{t('widget.noConversationsHint')}</span>
            </div>
          )}
          {view.name === 'list' && (data?.conversations.length ?? 0) > 0 && (
            <div className="body" role={single ? 'tabpanel' : undefined}>
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
                        {!single && (
                          <span className="kind" aria-hidden="true">
                            <Svg
                              d={c.kind === 'chat' ? Icon.chat : Icon.ticket}
                            />
                          </span>
                        )}
                        <strong>{c.subject ?? t(`type.${c.type}`)}</strong>
                        <span className="fine">
                          {timeAgo(c.lastMessageAt, locale, t)}
                        </span>
                      </span>
                      {c.preview &&
                        // A chat's subject is its first words, so the preview would say them twice.
                        !(
                          c.kind === 'chat' &&
                          c.subject &&
                          c.preview.startsWith(c.subject.replace(/…$/, ''))
                        ) && <span className="preview">{c.preview}</span>}
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
          {view.name === 'list' && !single && data && (
            <div className="list-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setView({ name: 'chat' })}>
                <Svg d={Icon.chat} />
                {t('widget.newMessage')}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setView(ticket)}>
                <Svg d={Icon.ticket} />
                {t('widget.newTicket')}
              </button>
            </div>
          )}
          {view.name === 'thread' && (
            <Thread
              key={subject}
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
              changes={changes}
              realtime={Boolean(data?.realtime)}
              who={who ?? null}
            />
          )}
          {showNav && (
            <Nav
              t={t}
              current={tab}
              help={Boolean(data?.help)}
              unread={unread > 0}
              onChange={next =>
                setView(
                  next === 'messages'
                    ? { name: 'list' }
                    : next === 'help'
                      ? { name: 'help', query: '' }
                      : home
                )
              }
            />
          )}
        </div>
      )}
      {!inline && (
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
      )}
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
  type: initialType,
  typeChoices,
  kind,
  hostContext,
  orgId,
  appVersion,
  errors,
  locale,
  onToken,
  onCreated,
  prefill,
}: Omit<WidgetProps, 'api'> & {
  api: Api;
  t: Translate;
  type: string;
  /** A chat is the message alone; a ticket asks for a subject and, for technical types, the page's details. */
  kind: 'chat' | 'ticket';
  /** Types the customer picks between in the form itself; switching keeps what they wrote. */
  typeChoices?: string[];
  prefill?: Prefill;
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
  const [type, setType] = useState(initialType);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  // A host's text goes into the fields the customer has left empty, so it
  // never replaces what they wrote.
  useEffect(() => {
    if (!prefill) return;
    setSubject(s => s || (prefill.subject?.slice(0, 200) ?? ''));
    setBody(b => (b.trim() ? b : (prefill.message ?? b)));
  }, [prefill]);
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
  const technical = kind === 'ticket' && TECHNICAL.has(type);
  // A message, a bug or a feature report is rarely formatted; the toolbar waits behind a toggle.
  const plain =
    kind === 'chat' || (technical && (type === 'bug' || type === 'feature'));
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
            kind,
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
    kind === 'ticket' && (type === 'lead' || type === 'bug')
      ? t(`form.message.${type}`)
      : t('form.message');

  // A message and a ticket keep the box being written in at the panel's floor,
  // beside the button that sends it; what qualifies it scrolls above.
  const pinned = kind === 'chat' || Boolean(typeChoices);
  const messageField = (
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
        placeholder={
          kind === 'chat'
            ? t('form.placeholder.chat')
            : t(`form.placeholder.${type}`)
        }
        value={body}
        onChange={setBody}
        t={t}
        toolbar={!plain || formatting}
        readOnly={sent}
      />
    </div>
  );

  return (
    <form
      className="form"
      onSubmit={submit}
      onPaste={event => {
        if (!technical || !session.uploads) return;
        for (const item of event.clipboardData.items) {
          const file = item.getAsFile();
          if (file?.type.startsWith('image/')) {
            addFile(file, file.name || 'pasted.png');
          }
        }
      }}>
      <div className="body">
        <fieldset className="sent-fields" disabled={sent}>
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
          {typeChoices && typeChoices.length > 1 && (
            <fieldset className="field type-choice">
              <legend>{t('form.category')}</legend>
              <div className="segmented">
                {typeChoices.map(choice => (
                  <label key={choice}>
                    <input
                      type="radio"
                      name="support-ticket-type"
                      value={choice}
                      checked={type === choice}
                      onChange={() => setType(choice)}
                    />
                    {choice === 'bug' || choice === 'feature'
                      ? t(`form.category.${choice}`)
                      : t(`type.${choice}`)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {kind === 'chat' && <p className="fine">{t('form.chatHint')}</p>}
          {!pinned && messageField}
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
                {translated(qualify.label, locale)}{' '}
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
                  {translated(o.label, locale)}
                </label>
              ))}
            </fieldset>
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
            {session.uploads && (
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
            )}
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
        {pinned && messageField}
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
        <div className={pinned ? 'send-row' : 'contents'}>
          {pinned && kind === 'ticket' && (
            <span className="fine">{t('form.referenceHint')}</span>
          )}
          <button
            type="submit"
            className="primary"
            disabled={state === 'sending'}>
            {state === 'sending' ? t('form.sending') : t('form.send')}
          </button>
        </div>
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
  changes,
  realtime,
  who,
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
  changes: EventTarget;
  /** Changes arrive as events, so the poll only covers a dropped stream. */
  realtime: boolean;
  /** Who answers, for the typing line. */
  who: string | null;
}) {
  const thread = useResource(
    () => api<ThreadData>(`widget/conversations/${id}`),
    id,
    realtime ? 30_000 : 5000
  );
  const { refresh } = thread;
  useEffect(() => {
    const onChange = (event: Event) => {
      if (
        (event as CustomEvent<{ conversationId: string }>).detail
          .conversationId === id
      ) {
        void refresh();
      }
    };
    changes.addEventListener('change', onChange);
    return () => changes.removeEventListener('change', onChange);
  }, [changes, id, refresh]);
  const typing = Boolean(thread.data?.conversation.typing);
  // Typing lapses on the server without an event, so the thread looks again once it would have.
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => void refresh(), 7000);
    return () => clearTimeout(timer);
  }, [typing, refresh]);
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
          {data.messages.map((m, index, all) => (
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
              {index === all.length - 1 &&
                m.author === 'contact' &&
                data.conversation.agentSeenAt &&
                Date.parse(data.conversation.agentSeenAt) >=
                  Date.parse(m.createdAt) && (
                  <span className={m.own ? 'seen mine' : 'seen'}>
                    {t('thread.seen')}
                  </span>
                )}
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
          {typing && (
            <span className="typing" role="status">
              {who
                ? t('thread.typingNamed', { name: who })
                : t('thread.typing')}
            </span>
          )}
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

function Home({
  t,
  locale,
  session,
  searches,
  onSearch,
  onChat,
  onTicket,
  onOpen,
  onAll,
}: {
  t: Translate;
  locale: Locale;
  session: Session;
  searches: string[];
  onSearch: (query: string) => void;
  onChat: () => void;
  onTicket: () => void;
  onOpen: (id: string) => void;
  onAll: () => void;
}) {
  const firstName = session.name?.trim().split(/\s+/)[0];
  const recent = [...session.conversations]
    .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt))
    .slice(0, 3);
  return (
    <div className="body home">
      <div className="greeting">
        <strong>
          {firstName
            ? t('widget.greetingNamed', { name: firstName })
            : t('widget.greeting')}
        </strong>
        <span className="muted">
          {session.help ? t('widget.homeIntro') : t('widget.homeIntroNoHelp')}
        </span>
      </div>
      {session.help && (
        <section className="section">
          <h2 className="section-label">{t('widget.searchDocs')}</h2>
          <label className="search">
            <Svg d={Icon.search} />
            <span className="sr-only">{t('widget.searchDocs')}</span>
            <input
              type="search"
              placeholder={t('widget.searchDocs')}
              value=""
              onChange={e => onSearch(e.target.value)}
            />
          </label>
        </section>
      )}
      <section className="section">
        <h2 className="section-label">{t('widget.writeToUs')}</h2>
        <button type="button" className="secondary action" onClick={onChat}>
          <Svg d={Icon.chat} />
          {t('widget.sendMessage')}
        </button>
        <button type="button" className="secondary action" onClick={onTicket}>
          <Svg d={Icon.ticket} />
          {t('widget.submitTicket')}
        </button>
      </section>
      <section className="section">
        <div className="section-head">
          <h2 className="section-label">{t('widget.recentMessages')}</h2>
          {recent.length > 0 && (
            <button type="button" className="link" onClick={onAll}>
              {t('widget.viewAll')}
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <span className="fine">{t('widget.recentEmpty')}</span>
        ) : (
          <ul className="recent">
            {recent.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpen(c.id)}>
                  <Svg d={c.kind === 'chat' ? Icon.chat : Icon.ticket} />
                  <span className="recent-title">
                    {c.subject ?? t(`type.${c.type}`)}
                  </span>
                  <span className="fine">
                    {timeAgo(c.lastMessageAt, locale, t)}
                  </span>
                  {c.unread && (
                    <span className="unread-dot">
                      <span className="sr-only">{t('widget.unread')}</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {session.help && searches.length > 0 && (
        <section className="section">
          <h2 className="section-label">{t('widget.recentSearches')}</h2>
          <ul className="chips">
            {searches.map(query => (
              <li key={query}>
                <button type="button" onClick={() => onSearch(query)}>
                  <Svg d={Icon.search} />
                  {query}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type HelpResult = { title: string; url: string; excerpt?: string };

function HelpSearch({
  api,
  t,
  locale,
  query,
  onQuery,
  onRemember,
  onAsk,
}: {
  api: Api;
  t: Translate;
  locale: Locale;
  query: string;
  onQuery: (query: string) => void;
  onRemember: (query: string) => void;
  onAsk: (query: string) => void;
}) {
  const [results, setResults] = useState<HelpResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const q = query.trim();
  useEffect(() => {
    setFailed(false);
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setResults(null);
    let current = true;
    const timer = setTimeout(() => {
      api<{ results: HelpResult[] }>(
        `widget/help?q=${encodeURIComponent(q.slice(0, 200))}&locale=${locale}`
      )
        .then(r => current && setResults(r.results))
        .catch(() => current && setFailed(true));
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q, api, locale]);

  const ask = (
    <button type="button" className="secondary" onClick={() => onAsk(query)}>
      <Svg d={Icon.chat} />
      {t('widget.askUs')}
    </button>
  );
  return (
    <div className="body help-view">
      <label className="search">
        <Svg d={Icon.search} />
        <span className="sr-only">{t('widget.searchDocs')}</span>
        <input
          type="search"
          placeholder={t('widget.searchDocs')}
          value={query}
          // biome-ignore lint/a11y/noAutofocus: Home's search hands the typing over to this field.
          autoFocus
          onChange={e => onQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onRemember(query);
          }}
        />
      </label>
      {q.length < 2 ? (
        <span className="fine">{t('widget.searchHint')}</span>
      ) : failed ? (
        <div className="empty">
          <strong>{t('widget.searchFailed')}</strong>
          {ask}
        </div>
      ) : results === null ? (
        <span className="fine" role="status">
          {t('widget.searching')}
        </span>
      ) : results.length === 0 ? (
        <div className="empty">
          <strong>{t('widget.noResults')}</strong>
          <span className="fine">{t('widget.noResultsHint')}</span>
          {ask}
        </div>
      ) : (
        <ul className="results">
          {results.map(r => (
            <li key={r.url}>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => onRemember(query)}>
                <span className="help-title">
                  {r.title}
                  <Svg d={Icon.external} />
                  <span className="sr-only">{t('widget.opensNewTab')}</span>
                </span>
                {r.excerpt && <span className="help-excerpt">{r.excerpt}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type NavTab = 'home' | 'messages' | 'help';

function Nav({
  t,
  current,
  help,
  unread,
  onChange,
}: {
  t: Translate;
  current: NavTab;
  help: boolean;
  unread: boolean;
  onChange: (tab: NavTab) => void;
}) {
  const tabs: [NavTab, string, string][] = [
    ['home', Icon.home, t('widget.home')],
    ['messages', Icon.messages, t('widget.messages')],
    ...(help
      ? [['help', Icon.help, t('widget.help')] as [NavTab, string, string]]
      : []),
  ];
  return (
    <nav className="nav" aria-label={t('widget.title')}>
      {tabs.map(([tab, icon, label]) => (
        <button
          key={tab}
          type="button"
          aria-current={current === tab ? 'page' : undefined}
          onClick={() => onChange(tab)}>
          <span className="nav-icon">
            <Svg d={icon} />
            {tab === 'messages' && unread && (
              <span className="nav-dot" aria-hidden="true" />
            )}
          </span>
          {label}
          {tab === 'messages' && unread && (
            <span className="sr-only">{t('widget.unread')}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
