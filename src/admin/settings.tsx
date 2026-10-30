import { useEffect, useState } from 'react';

import { AI_FEATURES, type AiFeature } from '../ai-features';
import type { Locale } from '../config';
import { useResource } from '../ui/api';
import { relativeTime, translator } from '../ui/i18n';
import { useAdmin } from './context';
import { humanizeKey, useToast } from './ui';

const LOCALES: { key: Locale; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'de', label: 'Deutsch' },
  { key: 'fr', label: 'Français' },
  { key: 'it', label: 'Italiano' },
];

type TeamMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: 'agent' | 'supervisor' | 'viewer';
};

type AuditRow = {
  id: string;
  agentId: string | null;
  agentName: string | null;
  action: string;
  target: string | null;
  targetName: string | null;
  targetReference: string | null;
  data: { fields?: string[] };
  createdAt: string;
};

const fieldName = (field: string) => humanizeKey(field.replace(/Id$/, ''));

/** Entries this close together, by one agent on one thing, read as one change. */
const GROUP_MS = 30 * 60_000;
const LINKED: Record<string, string> = {
  conversations: 'conversation',
  contacts: 'contact',
  companies: 'company',
};

function groupAudit(entries: AuditRow[]) {
  const groups: AuditRow[][] = [];
  for (const e of entries) {
    const last = groups.at(-1);
    const head = last?.at(-1);
    if (
      last &&
      head &&
      head.agentId === e.agentId &&
      (head.target ?? head.action) === (e.target ?? e.action) &&
      new Date(head.createdAt).toDateString() ===
        new Date(e.createdAt).toDateString() &&
      Date.parse(head.createdAt) - Date.parse(e.createdAt) < GROUP_MS
    ) {
      last.push(e);
    } else {
      groups.push([e]);
    }
  }
  return groups;
}

/** What the team changed, for a supervisor; 403 means the host hands out roles and this agent is not one. */
function AuditLog() {
  const { api, t, locale, href, navigate } = useAdmin();
  const [agentId, setAgentId] = useState('');
  const [older, setOlder] = useState<AuditRow[]>([]);
  const [more, setMore] = useState(true);
  const log = useResource(
    () =>
      api<{ entries: AuditRow[] }>(
        `agent/audit${agentId ? `?agentId=${agentId}` : ''}`
      ),
    `audit:${agentId}`
  );
  const team = useResource(
    () => api<{ agents: TeamMember[] }>('agent/agents'),
    'agents'
  );
  if (log.error) return null;
  const entries = [...(log.data?.entries ?? []), ...older];
  const action = (a: string) => {
    const phrase = t(`audit.${a}`);
    return phrase === `audit.${a}` ? a : phrase;
  };
  const day = (iso: string) => {
    const days = Math.round(
      (new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
        86_400_000
    );
    const label =
      days > -2
        ? new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
            days,
            'day'
          )
        : new Date(iso).toLocaleDateString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  const target = (e: AuditRow) => {
    const label = [e.targetReference, e.targetName].filter(Boolean).join(' ');
    if (!label || !e.target) return null;
    const key = LINKED[e.action.split(' ')[1]?.split('/')[0] ?? ''];
    if (!key) return <span>{label}</span>;
    const id = e.target;
    return (
      <a
        href={href({ [key]: id })}
        onClick={ev => {
          ev.preventDefault();
          navigate({ [key]: id });
        }}>
        {label}
      </a>
    );
  };
  const fields = (rows: AuditRow[]) => [
    ...new Set(rows.flatMap(r => r.data.fields ?? [])),
  ];
  const groups = groupAudit(entries);
  return (
    <div className="sa-card sa-audit">
      <div className="sa-toolbar">
        <h3 className="sa-grow">{t('admin.auditTitle')}</h3>
        <select
          className="sa-select"
          aria-label={t('admin.auditAgent')}
          value={agentId}
          onChange={e => {
            setAgentId(e.target.value);
            setOlder([]);
            setMore(true);
          }}>
          <option value="">{t('admin.auditAllAgents')}</option>
          {team.data?.agents.map(a => (
            <option key={a.id} value={a.id}>
              {a.name ?? a.email}
            </option>
          ))}
        </select>
      </div>
      <p className="sa-muted">{t('admin.auditHint')}</p>
      {log.data && entries.length === 0 && (
        <p className="sa-fine">{t('admin.auditEmpty')}</p>
      )}
      {groups.map((group, index) => {
        const [first] = group as [AuditRow, ...AuditRow[]];
        const last = group.at(-1) as AuditRow;
        const previous = groups[index - 1]?.[0];
        const actions = [...new Set(group.map(e => e.action))];
        const changed = fields(group);
        return (
          <section key={first.id} className="sa-audit-entry">
            {(!previous ||
              new Date(previous.createdAt).toDateString() !==
                new Date(first.createdAt).toDateString()) && (
              <h4 className="sa-audit-day">{day(first.createdAt)}</h4>
            )}
            <div className="sa-toolbar sa-fine">
              <strong>{first.agentName ?? t('event.formerAgent')}</strong>
              <span>
                {actions
                  .map(a => {
                    const count = group.filter(e => e.action === a).length;
                    return count > 1 ? `${action(a)} ×${count}` : action(a);
                  })
                  .join(' · ')}
              </span>
              {target(first)}
              <span className="sa-grow" />
              <time dateTime={first.createdAt}>
                {group.length > 1 &&
                  `${new Date(last.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}–`}
                {new Date(first.createdAt).toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
            {changed.length > 0 && (
              <p className="sa-fine sa-muted">
                {t('admin.auditFields', {
                  fields: changed.map(fieldName).join(', '),
                })}
              </p>
            )}
            {group.length > 1 && (
              <details className="sa-details">
                <summary>
                  {t('admin.auditChanges', { count: String(group.length) })}
                </summary>
                {group.map(e => (
                  <div key={e.id} className="sa-toolbar sa-fine">
                    <span>{action(e.action)}</span>
                    {e.data.fields && (
                      <span className="sa-muted">
                        {e.data.fields.map(fieldName).join(', ')}
                      </span>
                    )}
                    <span className="sa-grow" />
                    <time dateTime={e.createdAt}>
                      {relativeTime(e.createdAt, locale)}
                    </time>
                  </div>
                ))}
              </details>
            )}
          </section>
        );
      })}
      {more && entries.length >= 100 && (
        <button
          type="button"
          className="sa-link"
          onClick={async () => {
            const before = entries.at(-1)?.createdAt;
            const next = await api<{ entries: AuditRow[] }>(
              `agent/audit?${new URLSearchParams({ ...(agentId && { agentId }), ...(before && { before }) })}`
            );
            setOlder(rows => [...rows, ...next.entries]);
            setMore(next.entries.length >= 100);
          }}>
          {t('admin.auditOlder')}
        </button>
      )}
    </div>
  );
}

/** What the AI may do for the team; only shown when the host configured one. */
function AiSettings() {
  const { api, t, readOnly, refreshMe } = useAdmin();
  const toast = useToast();
  const saved = useResource(
    () => api<{ ai: Record<AiFeature, boolean> }>('agent/settings'),
    'settings'
  );
  const [ai, setAi] = useState<Record<AiFeature, boolean> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (saved.data) setAi(saved.data.ai);
  }, [saved.data]);
  if (!ai) return null;
  return (
    <form
      className="sa-card"
      onSubmit={async e => {
        e.preventDefault();
        setError(false);
        try {
          await api('agent/settings', { method: 'PUT', body: { ai } });
          await refreshMe();
          toast.show(t('admin.saved'));
        } catch {
          setError(true);
        }
      }}>
      <h3>{t('admin.aiTitle')}</h3>
      <p className="sa-muted">{t('admin.aiHint')}</p>
      <div className="sa-ai-features">
        {AI_FEATURES.map(feature => (
          <label key={feature} className="sa-toggle">
            <input
              type="checkbox"
              checked={ai[feature]}
              disabled={readOnly}
              onChange={e => setAi({ ...ai, [feature]: e.target.checked })}
            />
            {t(`admin.ai.${feature}`)}
          </label>
        ))}
      </div>
      {!readOnly && (
        <div className="sa-toolbar">
          <span className="sa-grow" />
          <button type="submit" className="sa-btn sa-primary">
            {t('admin.save')}
          </button>
        </div>
      )}
      {error && <p className="sa-error">{t('admin.error')}</p>}
      {toast.node}
    </form>
  );
}

/** Everyone who still gets agent mail; removing someone stops it until they open the admin again. */
function Team() {
  const { api, t, me, readOnly } = useAdmin();
  const team = useResource(
    () => api<{ agents: TeamMember[] }>('agent/agents'),
    'agents'
  );
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  return (
    <div className="sa-card">
      <h3>{t('admin.teamTitle')}</h3>
      <p className="sa-muted">{t('admin.teamHint')}</p>
      {team.data?.agents.map(a => (
        <div key={a.id} className="sa-toolbar">
          <span className="sa-grow">
            {a.name ?? a.email}
            {a.name && a.email && (
              <span className="sa-muted"> · {a.email}</span>
            )}
            {a.role !== 'agent' && (
              <span className="sa-pill" style={{ marginInlineStart: 8 }}>
                {t(`admin.role.${a.role}`)}
              </span>
            )}
          </span>
          {a.id !== me.agent.id && !readOnly && (
            <button
              type="button"
              className="sa-btn sa-ghost"
              onBlur={() => setConfirming(null)}
              onClick={async () => {
                // Removing hands their conversations back to the team.
                if (confirming !== a.id) {
                  setConfirming(a.id);
                  return;
                }
                setConfirming(null);
                setError(false);
                try {
                  await api(`agent/agents/${a.id}`, { method: 'DELETE' });
                  await team.refresh();
                } catch {
                  setError(true);
                }
              }}>
              {confirming === a.id
                ? t('admin.teamConfirmRemove')
                : t('admin.teamRemove')}
            </button>
          )}
        </div>
      ))}
      {error && <p className="sa-error">{t('admin.error')}</p>}
    </div>
  );
}

export function Settings() {
  const { api, t, readOnly, me } = useAdmin();
  const toast = useToast();
  const saved = useResource(
    () =>
      api<{ confirmation: Partial<Record<Locale, string>> }>('agent/settings'),
    'settings'
  );
  const [error, setError] = useState(false);
  const [confirmation, setConfirmation] = useState<
    Partial<Record<Locale, string>>
  >({});
  useEffect(() => {
    if (saved.data) setConfirmation(saved.data.confirmation);
  }, [saved.data]);

  return (
    <div className="sa">
      <form
        className="sa-card"
        onSubmit={async e => {
          e.preventDefault();
          setError(false);
          try {
            await api('agent/settings', {
              method: 'PUT',
              body: { confirmation },
            });
            toast.show(t('admin.saved'));
          } catch {
            setError(true);
          }
        }}>
        <h3>{t('admin.confirmationTitle')}</h3>
        <p className="sa-muted">{t('admin.confirmationHint')}</p>
        {LOCALES.map(({ key, label }) => (
          <label key={key} className="sa-field">
            {label}
            <textarea
              className="sa-textarea"
              maxLength={1000}
              readOnly={readOnly}
              // The default shows what is sent while this stays empty.
              placeholder={translator(key)('thread.confirmEmail')}
              value={confirmation[key] ?? ''}
              onChange={e =>
                setConfirmation(c => ({ ...c, [key]: e.target.value }))
              }
            />
          </label>
        ))}
        {!readOnly && (
          <div className="sa-toolbar">
            <span className="sa-grow" />
            <button type="submit" className="sa-btn sa-primary">
              {t('admin.save')}
            </button>
          </div>
        )}
        {error && <p className="sa-error">{t('admin.error')}</p>}
        {toast.node}
      </form>
      {me.ai && <AiSettings />}
      <Team />
      <AuditLog />
    </div>
  );
}
