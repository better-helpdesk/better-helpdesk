import { useEffect, useState } from 'react';

import { useResource } from '../ui/api';
import { HELPDESK_CHANGED, useAdmin } from './context';
import { Dialog } from './ui';

type SavedView = {
  id: string;
  name: string;
  query: string;
  shared: boolean;
  /** `null` when the server cannot apply the view's filters. */
  count: number | null;
};

const sameFilters = (query: string, current: Record<string, string>) => {
  const saved = Object.fromEntries(new URLSearchParams(query));
  const now = Object.fromEntries(
    Object.entries(current).filter(([, v]) => v !== '')
  );
  const keys = new Set([...Object.keys(saved), ...Object.keys(now)]);
  return [...keys].every(k => saved[k] === now[k]);
};

/** Saved filter sets, the agent's own and the team's, above the inbox list. */
export function SavedViews({
  filters,
  canSave,
}: {
  /** The inbox's current filters; an empty value is no filter. */
  filters: Record<string, string>;
  canSave: boolean;
}) {
  const { api, t, navigate } = useAdmin();
  const views = useResource(
    () => api<{ views: SavedView[] }>('agent/views'),
    'views',
    30_000
  );
  useEffect(() => {
    const refresh = () => void views.refresh();
    window.addEventListener(HELPDESK_CHANGED, refresh);
    return () => window.removeEventListener(HELPDESK_CHANGED, refresh);
  }, [views.refresh]);
  const [editing, setEditing] = useState<'save' | 'rename' | null>(null);
  const list = views.data?.views ?? [];
  const active = list.find(v => sameFilters(v.query, filters));
  if (list.length === 0 && !canSave) return null;

  return (
    <fieldset className="sa-views" aria-label={t('admin.views')}>
      {list.map(v => (
        <button
          key={v.id}
          type="button"
          className="sa-btn sa-chip"
          aria-pressed={v === active}
          title={v.shared ? t('admin.sharedView') : undefined}
          onClick={() =>
            navigate(Object.fromEntries(new URLSearchParams(v.query)))
          }>
          {v.name}
          {v.count !== null && <span className="sa-count num"> {v.count}</span>}
        </button>
      ))}
      {active ? (
        <>
          <button
            type="button"
            className="sa-btn sa-ghost"
            onClick={() => setEditing('rename')}>
            {t('admin.renameView')}
          </button>
          <button
            type="button"
            className="sa-btn sa-ghost"
            onClick={async () => {
              await api(`agent/views/${active.id}`, { method: 'DELETE' });
              await views.refresh();
            }}>
            {t('admin.deleteView')}
          </button>
        </>
      ) : (
        canSave && (
          <button
            type="button"
            className="sa-btn sa-ghost"
            onClick={() => setEditing('save')}>
            {t('admin.saveView')}
          </button>
        )
      )}
      <Dialog
        open={editing !== null}
        title={t(editing === 'rename' ? 'admin.renameView' : 'admin.saveView')}
        onClose={() => setEditing(null)}>
        <form
          onSubmit={async e => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const name = String(form.get('name') ?? '').trim();
            if (editing === 'rename' && active) {
              await api(`agent/views/${active.id}`, {
                method: 'PATCH',
                body: { name },
              });
            } else {
              await api('agent/views', {
                body: {
                  name,
                  query: new URLSearchParams(
                    Object.entries(filters).filter(([, v]) => v !== '')
                  ).toString(),
                  shared: form.get('shared') === 'on',
                },
              });
            }
            setEditing(null);
            await views.refresh();
          }}>
          <h2>
            {t(editing === 'rename' ? 'admin.renameView' : 'admin.saveView')}
          </h2>
          <label className="sa-field">
            {t('admin.name')}
            <input
              className="sa-input"
              name="name"
              required
              maxLength={80}
              defaultValue={editing === 'rename' ? active?.name : ''}
            />
          </label>
          {editing === 'save' && (
            <label className="sa-toggle">
              <input type="checkbox" name="shared" />
              {t('admin.shareView')}
            </label>
          )}
          <div className="sa-dialog-foot">
            <button
              type="button"
              className="sa-btn"
              onClick={() => setEditing(null)}>
              {t('admin.cancel')}
            </button>
            <button type="submit" className="sa-btn sa-primary">
              {t('admin.save')}
            </button>
          </div>
        </form>
      </Dialog>
    </fieldset>
  );
}
