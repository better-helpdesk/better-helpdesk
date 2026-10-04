import { useEffect, useId, useRef, useState } from 'react';

import { useResource } from '../ui/api';
import { relativeTime } from '../ui/i18n';
import { plainText, RichText } from '../ui/rich';
import { RichEditor, type RichEditorHandle } from '../ui/rich-editor';
import { useAdmin } from './context';
import { ContactPicker } from './pickers';
import {
  Avatar,
  browserLabel,
  humanizeKey,
  Loading,
  paths,
  Svg,
  useToast,
} from './ui';

type Detail = {
  conversation: {
    id: string;
    reference: string;
    subject: string | null;
    title: string | null;
    customerSubject: string | null;
    type: string;
    status: string;
    priority: string;
    inbox: string;
    assigneeId: string | null;
    companyId: string | null;
    context: {
      url?: string;
      title?: string;
      userAgent?: string;
      viewport?: string;
      locale?: string;
      appVersion?: string;
      referrer?: string;
      landingPage?: string;
      utm?: Record<string, string>;
      host?: Record<string, string>;
      errors?: string[];
    };
    aiSuggestion: {
      type?: string;
      priority?: string;
      title?: string;
      summary?: string;
      duplicates?: {
        conversationId: string;
        reference: string;
        reason: string;
      }[];
      acceptedAt?: string;
    } | null;
  };
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    verified: boolean;
    locale: string | null;
    tags: string[];
  } | null;
  company: { id: string; name: string } | null;
  suggestedCompany: { id: string; name: string } | null;
  customerContext: Record<string, string>;
  participants: { id: string; name: string | null; email: string | null }[];
  messages: {
    id: string;
    authorType: 'contact' | 'agent' | 'system';
    body: string;
    internal: boolean;
    verified: boolean | null;
    createdAt: string;
    agentName: string | null;
    contactName: string | null;
  }[];
  attachments: { id: string; filename: string; size: number }[];
};

export const FREE_MAIL =
  /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|gmx|web|bluewin|proton|protonmail)\./i;

export function ConversationView({ id }: { id: string }) {
  const { api, apiBase, t, me, href, navigate, locale, inboxName } = useAdmin();
  const detail = useResource(
    () => api<Detail>(`agent/conversations/${id}`),
    id,
    5000
  );
  const agents = useResource(
    () =>
      api<{
        agents: { id: string; name: string | null; email: string | null }[];
      }>('agent/agents'),
    'agents'
  );
  const canned = useResource(
    () =>
      api<{
        replies: {
          id: string;
          title: string;
          body: string;
          locale: string | null;
        }[];
      }>('agent/canned'),
    'canned'
  );
  const [body, setBody] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState<'send' | 'draft' | null>(null);
  const [error, setError] = useState<'send' | 'resolve' | null>(null);
  const composer = useRef<RichEditorHandle>(null);
  const toast = useToast();

  const data = detail.data;
  if (detail.error) return <p className="sa-error">{t('admin.error')}</p>;
  if (!data) return <Loading label={t('admin.loading')} />;
  const c = data.conversation;

  const patch = async (values: Record<string, unknown>) => {
    await api(`agent/conversations/${id}`, { method: 'PATCH', body: values });
    await detail.refresh();
  };

  const send = async (resolve: boolean) => {
    if (!body.trim() || busy) return;
    setBusy('send');
    setError(null);
    try {
      await api(`agent/conversations/${id}/messages`, {
        body: { body, internal },
      });
    } catch {
      setError('send');
      setBusy(null);
      return;
    }
    // Sent: the text must not stay behind to be sent twice.
    setBody('');
    try {
      if (resolve) await patch({ status: 'resolved' });
      else await detail.refresh();
      toast.show(t('thread.sent'));
    } catch {
      setError('resolve');
      await detail.refresh().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  const contactLocale = data.contact?.locale?.slice(0, 2).toLowerCase();
  // Replies in the customer's language first, then language-neutral ones.
  const replies = [...(canned.data?.replies ?? [])].sort(
    (a, b) =>
      Number(b.locale === contactLocale) - Number(a.locale === contactLocale) ||
      Number(!b.locale) - Number(!a.locale)
  );
  const slash = /^\/(\S*)$/.exec(body);
  const slashMatches = slash
    ? replies
        .filter(r =>
          r.title.toLowerCase().includes((slash[1] ?? '').toLowerCase())
        )
        .slice(0, 6)
    : [];
  const insert = (text: string) => {
    setBody(current =>
      /^\/\S*$/.test(current) || !current ? text : `${current}\n\n${text}`
    );
    setSlashIndex(0);
    requestAnimationFrame(() => composer.current?.focus());
  };
  const firstName = data.contact?.name?.split(/\s+/)[0] ?? '';
  // Canned replies may say {firstName} and {reference}.
  const fill = (text: string) =>
    text
      .replaceAll('{firstName}', firstName)
      .replaceAll('{reference}', c.reference);

  const suggestion = c.aiSuggestion;
  // A title the team already set, by hand or by accepting, is not up for re-suggestion.
  const suggestionTitleChange = Boolean(
    suggestion?.title && !c.title && suggestion.title !== c.subject
  );
  const suggestionChanges =
    suggestion && !suggestion.acceptedAt
      ? [
          suggestion.type && suggestion.type !== c.type
            ? `${t(`agentType.${c.type}`)} → ${t(`agentType.${suggestion.type}`)}`
            : null,
          suggestion.priority && suggestion.priority !== c.priority
            ? `${t(`priority.${c.priority}`)} → ${t(`priority.${suggestion.priority}`)}`
            : null,
          suggestionTitleChange
            ? `${t('admin.title')}: ${suggestion.title}`
            : null,
        ].filter(Boolean)
      : [];
  const answered = data.messages.some(m => m.authorType === 'agent');
  // Triage is for the first look; once answered, only a type or priority change still matters.
  const showSuggestion =
    suggestion &&
    !suggestion.acceptedAt &&
    (answered
      ? suggestionChanges.length > (suggestionTitleChange ? 1 : 0)
      : suggestionChanges.length > 0 ||
        (suggestion.duplicates?.length ?? 0) > 0);
  const domain = data.contact?.email?.split('@')[1];
  const context = c.context;

  return (
    <div className="sa">
      <div className="sa-page-head">
        <a
          className="sa-btn sa-back"
          href={href({})}
          onClick={e => {
            e.preventDefault();
            navigate({});
          }}>
          <Svg d={paths.back} />
          {t('admin.inbox')}
        </a>
        <div>
          <h2>
            <span className="num sa-muted">{c.reference}</span>{' '}
            <TitleEditor
              value={c.subject ?? ''}
              fallback={t(`agentType.${c.type}`)}
              onSave={subject => patch({ subject })}
            />
          </h2>
          {c.title && c.customerSubject && c.customerSubject !== c.title && (
            <p className="sa-fine">
              {t('admin.customerSees', { subject: c.customerSubject })}
            </p>
          )}
        </div>
      </div>
      <div className="sa-split">
        <div className="sa">
          <div className="sa-toolbar">
            <Select
              label={t('admin.status')}
              value={c.status}
              options={me.statuses}
              render={s => t(`agentStatus.${s}`)}
              onChange={v => patch({ status: v })}
            />
            <Select
              label={t('admin.priority')}
              value={c.priority}
              options={me.priorities}
              render={p => t(`priority.${p}`)}
              onChange={v => patch({ priority: v })}
            />
            <Select
              label={t('admin.type')}
              value={c.type}
              options={me.types}
              render={v => t(`agentType.${v}`)}
              onChange={v => patch({ type: v })}
            />
            <Select
              label={t('admin.inboxLabel')}
              value={c.inbox}
              options={me.inboxes}
              render={inboxName}
              onChange={v => patch({ inbox: v })}
            />
            <select
              className="sa-select"
              aria-label={t('admin.assignee')}
              value={c.assigneeId ?? ''}
              onChange={e => patch({ assigneeId: e.target.value || null })}>
              <option value="">{t('admin.unassigned')}</option>
              {agents.data?.agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.email}
                </option>
              ))}
            </select>
          </div>

          <div className="sa-thread">
            {data.messages.map(m => {
              const name =
                m.authorType === 'agent'
                  ? (m.agentName ?? t('thread.support'))
                  : m.authorType === 'system'
                    ? t('admin.automated')
                    : (m.contactName ?? data.contact?.email ?? '');
              return (
                <article
                  key={m.id}
                  className="sa-msg"
                  data-author={m.authorType}
                  data-internal={m.internal}>
                  <Avatar name={name} agent={m.authorType === 'agent'} />
                  <div>
                    <header>
                      <strong>{name}</strong>
                      {m.authorType === 'contact' &&
                        m.verified === false &&
                        ` · ${t('admin.unverified')}`}
                      {m.internal && ` · ${t('admin.note')}`} ·{' '}
                      {relativeTime(m.createdAt, locale)}
                    </header>
                    <div className="sa-msg-body">
                      <RichText
                        text={m.body}
                        hosts={m.authorType === 'contact'}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {showSuggestion && (
            <div className="sa-suggest">
              <Svg d={paths.sparkle} />
              <span className="sa-grow">
                <span>
                  <strong>{t('admin.suggested')}:</strong>{' '}
                  {suggestionChanges.join(' · ')}
                </span>
                {suggestion.summary && (
                  <span className="sa-fine sa-clamp">{suggestion.summary}</span>
                )}
                {suggestion.duplicates && suggestion.duplicates.length > 0 && (
                  <span className="sa-fine">
                    {' '}
                    {t('admin.duplicates')}:{' '}
                    {suggestion.duplicates.map(d => (
                      <a
                        key={d.conversationId}
                        href={href({ conversation: d.conversationId })}
                        title={d.reason}
                        onClick={e => {
                          e.preventDefault();
                          navigate({ conversation: d.conversationId });
                        }}>
                        {d.reference}{' '}
                      </a>
                    ))}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="sa-btn"
                onClick={async () => {
                  await api(`agent/conversations/${id}/suggestion`, {
                    body: { action: 'accept' },
                  });
                  await detail.refresh();
                }}>
                {t('admin.accept')}
              </button>
              <button
                type="button"
                className="sa-btn sa-ghost sa-quiet"
                aria-label={t('admin.dismiss')}
                onClick={async () => {
                  await api(`agent/conversations/${id}/suggestion`, {
                    body: { action: 'dismiss' },
                  });
                  await detail.refresh();
                }}>
                <Svg d={paths.x} />
              </button>
            </div>
          )}

          <form
            className="sa-composer"
            data-internal={internal}
            onSubmit={e => {
              e.preventDefault();
              void send(false);
            }}>
            <RichEditor
              ref={composer}
              className="rt-composer"
              t={t}
              label={internal ? t('admin.note') : t('admin.reply')}
              placeholder={
                internal
                  ? t('admin.noteHint')
                  : `${t('admin.reply')} · ${t('admin.slashHint')}`
              }
              value={body}
              onChange={next => {
                setBody(next);
                setSlashIndex(0);
              }}
              onKeyDown={e => {
                if (slashMatches.length > 0) {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const step = e.key === 'ArrowDown' ? 1 : -1;
                    setSlashIndex(
                      i =>
                        (i + step + slashMatches.length) % slashMatches.length
                    );
                    return;
                  }
                  const picked = slashMatches[slashIndex];
                  if (e.key === 'Enter' && picked) {
                    e.preventDefault();
                    insert(fill(picked.body));
                    return;
                  }
                }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send(e.shiftKey);
                }
              }}
            />
            {slashMatches.length > 0 && (
              <div
                className="sa-slash"
                role="listbox"
                aria-label={t('admin.insertCanned')}>
                {slashMatches.map((r, index) => (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={index === slashIndex}
                    onMouseDown={e => {
                      e.preventDefault();
                      insert(fill(r.body));
                    }}>
                    <strong>{r.title}</strong>
                    {r.locale && (
                      <span className="sa-pill">{r.locale.toUpperCase()}</span>
                    )}
                    <span className="sa-fine">{plainText(r.body)}</span>
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p className="sa-error">
                {t(
                  error === 'resolve' ? 'admin.sentNotResolved' : 'admin.error'
                )}
              </p>
            )}
            <div className="sa-composer-foot">
              <fieldset className="sa-seg">
                <button
                  type="button"
                  aria-pressed={!internal}
                  onClick={() => setInternal(false)}>
                  {t('admin.reply')}
                </button>
                <button
                  type="button"
                  aria-pressed={internal}
                  onClick={() => setInternal(true)}>
                  {t('admin.note')}
                </button>
              </fieldset>
              <CannedMenu
                replies={replies}
                onPick={text => insert(fill(text))}
              />
              {me.ai && (
                <button
                  type="button"
                  className="sa-btn sa-ghost"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy('draft');
                    try {
                      const draft = await api<{ text: string }>(
                        `agent/conversations/${id}/draft`,
                        { body: {} }
                      );
                      insert(draft.text);
                      setInternal(false);
                    } catch {
                      setError('send');
                    } finally {
                      setBusy(null);
                    }
                  }}>
                  <Svg d={paths.sparkle} />
                  {busy === 'draft' ? t('admin.drafting') : t('admin.draft')}
                </button>
              )}
              <span className="sa-grow sa-kbd">
                <kbd>⌘↵</kbd> {t('admin.send')} · <kbd>⌘⇧↵</kbd>{' '}
                {t('admin.sendResolve')}
              </span>
              {!internal && c.status !== 'resolved' && (
                <button
                  type="button"
                  className="sa-btn"
                  disabled={busy !== null || !body.trim()}
                  onClick={() => void send(true)}>
                  {t('admin.sendResolve')}
                </button>
              )}
              <button
                type="submit"
                className="sa-btn sa-primary"
                disabled={busy !== null || !body.trim()}>
                {t('admin.send')}
              </button>
            </div>
          </form>
        </div>

        <aside className="sa">
          <div className="sa-card">
            <h3>{t('admin.contact')}</h3>
            {data.contact && (
              <div className="sa-who">
                <Avatar name={data.contact.name ?? data.contact.email} />
                <div>
                  <a
                    href={href({ contact: data.contact.id })}
                    onClick={e => {
                      e.preventDefault();
                      navigate({ contact: data.contact?.id ?? '' });
                    }}>
                    <strong>{data.contact.name ?? data.contact.email}</strong>
                  </a>
                  <div className="sa-fine">
                    {data.contact.email} ·{' '}
                    {data.contact.verified
                      ? t('admin.verified')
                      : t('admin.unverified')}
                  </div>
                </div>
              </div>
            )}
            {(data.contact?.tags ?? [])
              .filter(tag => me.segments?.[tag])
              .map(tag => (
                <span
                  key={tag}
                  className="sa-pill"
                  style={{ justifySelf: 'start' }}
                  title={me.segments[tag]?.label[locale]}>
                  {me.segments[tag]?.badge[locale]}
                </span>
              ))}
          </div>

          <div className="sa-card">
            <h3>{t('admin.company')}</h3>
            {data.company ? (
              <a
                href={href({ company: data.company.id })}
                onClick={e => {
                  e.preventDefault();
                  navigate({ company: data.company?.id ?? '' });
                }}>
                <strong>{data.company.name}</strong>
              </a>
            ) : (
              <>
                <span className="sa-muted">{t('admin.company.none')}</span>
                {data.suggestedCompany ? (
                  <button
                    type="button"
                    className="sa-btn"
                    onClick={async () => {
                      if (!data.contact || !data.suggestedCompany) return;
                      await api(`agent/contacts/${data.contact.id}`, {
                        method: 'PATCH',
                        body: { companyId: data.suggestedCompany.id },
                      });
                      await patch({ companyId: data.suggestedCompany.id });
                    }}>
                    {t('admin.assignCompany')}: {data.suggestedCompany.name}
                  </button>
                ) : domain && !FREE_MAIL.test(domain) && data.contact ? (
                  <button
                    type="button"
                    className="sa-btn"
                    onClick={async () => {
                      if (!data.contact) return;
                      const created = await api<{ company: { id: string } }>(
                        'agent/companies',
                        { body: { name: domain, domain } }
                      );
                      await api(`agent/contacts/${data.contact.id}`, {
                        method: 'PATCH',
                        body: { companyId: created.company.id },
                      });
                      await patch({ companyId: created.company.id });
                    }}>
                    <Svg d={paths.plus} />
                    {t('admin.createCompanyFrom', { domain })}
                  </button>
                ) : null}
              </>
            )}
            {Object.keys(data.customerContext).length > 0 && (
              <dl className="sa-kv">
                {Object.entries(data.customerContext).map(([k, v]) => (
                  <Pair key={k} label={humanizeKey(k)} value={v} />
                ))}
              </dl>
            )}
            {c.type === 'lead' && data.contact && (
              <button
                type="button"
                className="sa-btn"
                onClick={async () => {
                  await api('agent/deals', {
                    body: {
                      title: c.subject ?? data.contact?.name ?? c.reference,
                      contactId: data.contact?.id,
                      companyId: data.company?.id ?? c.companyId ?? undefined,
                    },
                  });
                  toast.show(t('admin.saved'));
                }}>
                <Svg d={paths.plus} />
                {t('admin.createDeal')}
              </button>
            )}
          </div>

          {Object.keys(context).length > 0 && (
            <div className="sa-card">
              <h3>{t('admin.capturedContext')}</h3>
              <dl className="sa-kv">
                {context.url && (
                  <Pair
                    label={t('context.url')}
                    value={<Link url={context.url} />}
                  />
                )}
                {context.title && (
                  <Pair label={t('context.title')} value={context.title} />
                )}
                {context.userAgent && (
                  <Pair
                    label={t('context.userAgent')}
                    value={browserLabel(context.userAgent)}
                  />
                )}
                {context.viewport && (
                  <Pair
                    label={t('context.viewport')}
                    value={context.viewport}
                  />
                )}
                {context.locale && (
                  <Pair
                    label={t('context.locale')}
                    value={languageName(context.locale, locale)}
                  />
                )}
                {context.appVersion && (
                  <Pair
                    label={t('context.appVersion')}
                    value={context.appVersion}
                  />
                )}
                {context.landingPage && context.landingPage !== context.url && (
                  <Pair
                    label={humanizeKey('landingPage')}
                    value={<Link url={context.landingPage} />}
                  />
                )}
                {context.referrer && (
                  <Pair
                    label={humanizeKey('referrer')}
                    value={<Link url={context.referrer} />}
                  />
                )}
                {[
                  // jsonb reorders keys; keep the conventional UTM order.
                  ...Object.entries(context.utm ?? {}).sort(
                    ([a], [b]) => UTM_ORDER.indexOf(a) - UTM_ORDER.indexOf(b)
                  ),
                  // The segment already shows as a badge on the contact.
                  ...Object.entries(context.host ?? {}).filter(
                    ([k]) => k !== 'segment'
                  ),
                ].map(([k, v]) => (
                  <Pair key={k} label={humanizeKey(k)} value={v} />
                ))}
              </dl>
              {context.userAgent && (
                <details className="sa-details">
                  <summary>{t('admin.rawUserAgent')}</summary>
                  <pre>{context.userAgent}</pre>
                </details>
              )}
              {context.errors && context.errors.length > 0 && (
                <details className="sa-details">
                  <summary>
                    {context.errors.length === 1
                      ? t('admin.errorsOne')
                      : t('admin.errorsCount', {
                          count: String(context.errors.length),
                        })}
                  </summary>
                  <pre>{context.errors.join('\n')}</pre>
                </details>
              )}
            </div>
          )}

          {data.attachments.length > 0 && (
            <div className="sa-card">
              <h3>{t('admin.attachments')}</h3>
              {data.attachments.map(a => (
                <a
                  key={a.id}
                  href={`${apiBase}/agent/conversations/${id}/attachments/${a.id}/`}
                  target="_blank"
                  rel="noreferrer">
                  {a.filename}
                </a>
              ))}
            </div>
          )}

          <div className="sa-card">
            <h3>{t('admin.participants')}</h3>
            {data.participants.map(p => (
              <span key={p.id} className="sa-who">
                <Avatar name={p.name ?? p.email} />
                {p.name ?? p.email}
              </span>
            ))}
            <ContactPicker
              label={t('admin.addParticipant')}
              onPick={async contact => {
                await api(`agent/conversations/${id}/participants`, {
                  body: { contactId: contact.id },
                });
                await detail.refresh();
              }}
            />
          </div>
        </aside>
      </div>
      {toast.node}
    </div>
  );
}

/** The team's name for a conversation; the customer keeps seeing their own. */
function TitleEditor({
  value,
  fallback,
  onSave,
}: {
  value: string;
  fallback: string;
  onSave: (title: string) => Promise<void>;
}) {
  const { t } = useAdmin();
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null) {
    return (
      <button
        type="button"
        className="sa-title-edit"
        title={t('admin.rename')}
        onClick={() => setDraft(value)}>
        {value || fallback}
      </button>
    );
  }
  const commit = async () => {
    const next = draft.trim();
    setDraft(null);
    if (next && next !== value) await onSave(next);
  };
  return (
    <input
      className="sa-input sa-title-input"
      aria-label={t('admin.rename')}
      // biome-ignore lint/a11y/noAutofocus: opened by the click that asked to rename.
      autoFocus
      maxLength={200}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={e => {
        // Saving happens once, on blur.
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}

type CannedReply = {
  id: string;
  title: string;
  body: string;
  locale: string | null;
};

function CannedMenu({
  replies,
  onPick,
}: {
  replies: CannedReply[];
  onPick: (body: string) => void;
}) {
  const { t, href, navigate } = useAdmin();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const matches = replies.filter(r =>
    `${r.title} ${r.body}`.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const close = () => {
    setOpen(false);
    setQuery('');
    setIndex(0);
  };
  const pick = (reply: CannedReply) => {
    onPick(reply.body);
    close();
  };

  return (
    <div className="sa-canned" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="sa-btn sa-ghost"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('admin.slashHint')}
        onClick={() => (open ? close() : setOpen(true))}>
        <Svg d={paths.text} />
        {t('admin.cannedReplies')}
      </button>
      {open && (
        <div className="sa-canned-pop">
          {replies.length > 0 && (
            <input
              className="sa-input"
              // biome-ignore lint/a11y/noAutofocus: the menu opens for typing.
              autoFocus
              aria-label={t('admin.search')}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={
                matches[index] ? `${listId}-${index}` : undefined
              }
              placeholder={t('admin.searchCanned')}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setIndex(0);
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  close();
                  trigger.current?.focus();
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const step = e.key === 'ArrowDown' ? 1 : -1;
                  setIndex(
                    i =>
                      (i + step + matches.length) % Math.max(matches.length, 1)
                  );
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const picked = matches[index];
                  if (picked) pick(picked);
                }
              }}
            />
          )}
          <div
            id={listId}
            className="sa-slash"
            role="listbox"
            aria-label={t('admin.cannedReplies')}>
            {matches.map((r, i) => (
              <button
                key={r.id}
                id={`${listId}-${i}`}
                type="button"
                role="option"
                aria-selected={i === index}
                onMouseEnter={() => setIndex(i)}
                onClick={() => pick(r)}>
                <strong>{r.title}</strong>
                {r.locale && (
                  <span className="sa-pill">{r.locale.toUpperCase()}</span>
                )}
                <span className="sa-fine">{r.body}</span>
              </button>
            ))}
            {matches.length === 0 && (
              <p className="sa-fine sa-canned-empty">
                {replies.length === 0
                  ? t('admin.noCanned')
                  : t('admin.noCannedMatch')}
              </p>
            )}
          </div>
          <a
            className="sa-canned-foot"
            href={href({ view: 'canned' })}
            onClick={e => {
              e.preventDefault();
              navigate({ view: 'canned' });
            }}>
            {t('admin.manageCanned')}
          </a>
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  render,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  render: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="sa-select"
      aria-label={label}
      title={label}
      value={value}
      onChange={e => onChange(e.target.value)}>
      {options.map(o => (
        // The closed select shows only this text, so it names its field.
        <option key={o} value={o}>
          {label}: {render(o)}
        </option>
      ))}
    </select>
  );
}

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function languageName(code: string, locale: string) {
  try {
    return (
      new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

const UTM_ORDER = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
];

/** Customer-supplied URLs link only when they are http(s). */
function Link({ url }: { url: string }) {
  // The query is mostly UTM parameters, which the panel lists on their own rows.
  return /^https?:\/\//i.test(url) ? (
    <a href={url} target="_blank" rel="noreferrer noopener" title={url}>
      {url.replace(/^https?:\/\//i, '').replace(/[?#].*$/, '')}
    </a>
  ) : (
    url
  );
}
