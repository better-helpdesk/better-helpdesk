import { useEffect, useState } from 'react';

import type { Locale } from '../config';
import { useResource } from '../ui/api';
import { relativeTime, translator } from '../ui/i18n';
import { useAdmin } from './context';
import { useToast } from './ui';

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
  data: { fields?: string[] };
  createdAt: string;
};

/** What the team changed, for a supervisor; 403 means the host hands out roles and this agent is not one. */
function AuditLog() {
  const { api, t, locale, href, navigate } = useAdmin();
  const log = useResource(
    () => api<{ entries: AuditRow[] }>('agent/audit'),
    'audit'
  );
  if (log.error) return null;
  const entries = log.data?.entries ?? [];
  return (
    <div className="sa-card">
      <h3>{t('admin.auditTitle')}</h3>
      <p className="sa-muted">{t('admin.auditHint')}</p>
      {log.data && entries.length === 0 && (
        <p className="sa-fine">{t('admin.auditEmpty')}</p>
      )}
      {entries.map(e => {
        const [method, path] = e.action.split(' ');
        const conversation =
          path?.startsWith('conversations/:id') && e.target ? e.target : null;
        return (
          <div key={e.id} className="sa-toolbar sa-fine">
            <span>{e.agentName ?? t('event.formerAgent')}</span>
            <code>{method}</code>
            {conversation ? (
              <a
                href={href({ conversation })}
                onClick={ev => {
                  ev.preventDefault();
                  navigate({ conversation });
                }}>
                {path}
              </a>
            ) : (
              <span>{path}</span>
            )}
            {e.data.fields && (
              <span className="sa-muted">
                {t('admin.auditFields', { fields: e.data.fields.join(', ') })}
              </span>
            )}
            <span className="sa-grow" />
            <time dateTime={e.createdAt}>
              {relativeTime(e.createdAt, locale)}
            </time>
          </div>
        );
      })}
    </div>
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
  const { api, t, readOnly } = useAdmin();
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
      <Team />
      <AuditLog />
    </div>
  );
}
