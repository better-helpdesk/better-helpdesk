import { useEffect, useState } from 'react';

import type { Locale } from '../config';
import { useResource } from '../ui/api';
import { translator } from '../ui/i18n';
import { useAdmin } from './context';
import { useToast } from './ui';

const LOCALES: { key: Locale; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'de', label: 'Deutsch' },
];

type TeamMember = { id: string; name: string | null; email: string | null };

/** Everyone who still gets agent mail; removing someone stops it until they open the admin again. */
function Team() {
  const { api, t, me } = useAdmin();
  const team = useResource(
    () => api<{ agents: TeamMember[] }>('agent/agents'),
    'agents'
  );
  const [error, setError] = useState(false);
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
          </span>
          {a.id !== me.agent.id && (
            <button
              type="button"
              className="sa-btn sa-ghost"
              onClick={async () => {
                setError(false);
                try {
                  await api(`agent/agents/${a.id}`, { method: 'DELETE' });
                  await team.refresh();
                } catch {
                  setError(true);
                }
              }}>
              {t('admin.teamRemove')}
            </button>
          )}
        </div>
      ))}
      {error && <p className="sa-error">{t('admin.error')}</p>}
    </div>
  );
}

export function Settings() {
  const { api, t } = useAdmin();
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
              // The default shows what is sent while this stays empty.
              placeholder={translator(key)('thread.confirmEmail')}
              value={confirmation[key] ?? ''}
              onChange={e =>
                setConfirmation(c => ({ ...c, [key]: e.target.value }))
              }
            />
          </label>
        ))}
        <div className="sa-toolbar">
          <span className="sa-grow" />
          <button type="submit" className="sa-btn sa-primary">
            {t('admin.save')}
          </button>
        </div>
        {error && <p className="sa-error">{t('admin.error')}</p>}
        {toast.node}
      </form>
      <Team />
    </div>
  );
}
