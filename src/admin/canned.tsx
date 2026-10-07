import { useRef, useState } from 'react';

import { useResource } from '../ui/api';
import { RichText } from '../ui/rich';
import { RichEditor, type RichEditorHandle } from '../ui/rich-editor';
import { useAdmin } from './context';
import { Dialog, Empty, paths, Svg, useConfirm } from './ui';

type Reply = {
  id: string;
  title: string;
  body: string;
  locale: string | null;
};

export function CannedReplies() {
  const { api, t } = useAdmin();
  const list = useResource(
    () => api<{ replies: Reply[] }>('agent/canned'),
    'canned'
  );
  const [editing, setEditing] = useState<Reply | 'new' | null>(null);
  const existing = editing !== 'new' ? editing : null;
  const bodyRef = useRef<RichEditorHandle>(null);
  const [draft, setDraft] = useState('');
  const open = (reply: Reply | 'new') => {
    setDraft(reply === 'new' ? '' : reply.body);
    setEditing(reply);
  };
  const heading = t(existing ? 'admin.editCanned' : 'admin.newCanned');
  const confirmDelete = useConfirm(t);

  return (
    <div className="sa">
      <div className="sa-toolbar">
        <span className="sa-grow" />
        <button
          type="button"
          className="sa-btn sa-primary"
          onClick={() => open('new')}>
          <Svg d={paths.plus} />
          {t('admin.newCanned')}
        </button>
      </div>
      {list.data && (
        <div className="sa-table-wrap">
          {list.data.replies.length === 0 ? (
            <Empty text={t('admin.emptyCanned')} />
          ) : (
            <table className="sa-table sa-canned-table">
              <thead>
                <tr>
                  <th>{t('admin.title')}</th>
                  <th>{t('admin.body')}</th>
                  <th>{t('admin.language')}</th>
                  <th>
                    <span className="sa-sr-only">{t('admin.edit')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.replies.map(r => (
                  <tr key={r.id} onClick={() => open(r)}>
                    <td>
                      <strong>{r.title}</strong>
                    </td>
                    <td className="sa-muted">
                      <div className="sa-clamp">
                        <RichText text={r.body} />
                      </div>
                    </td>
                    <td>
                      {r.locale ? (
                        <span className="sa-pill">
                          {r.locale.toUpperCase()}
                        </span>
                      ) : (
                        <span className="sa-fine">
                          {t('admin.anyLanguage')}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="sa-row-actions">
                        <button
                          type="button"
                          className="sa-btn sa-ghost"
                          onClick={e => {
                            e.stopPropagation();
                            open(r);
                          }}>
                          {t('admin.edit')}
                        </button>
                        <button
                          type="button"
                          className="sa-btn sa-ghost sa-danger"
                          onClick={async e => {
                            e.stopPropagation();
                            if (!(await confirmDelete.ask())) return;
                            await api(`agent/canned/${r.id}`, {
                              method: 'DELETE',
                            });
                            await list.refresh();
                          }}>
                          {t('admin.delete')}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {confirmDelete.node}
      <Dialog
        open={editing !== null}
        title={heading}
        onClose={() => setEditing(null)}>
        <form
          key={existing?.id ?? 'new'}
          onSubmit={async e => {
            e.preventDefault();
            if (!draft.trim()) {
              bodyRef.current?.focus();
              return;
            }
            const form = new FormData(e.currentTarget);
            const reply = {
              title: String(form.get('title') ?? '').trim(),
              body: draft.trim(),
              locale: String(form.get('locale') ?? '') || null,
            };
            await api(
              existing ? `agent/canned/${existing.id}` : 'agent/canned',
              {
                method: existing ? 'PATCH' : 'POST',
                body: reply,
              }
            );
            setEditing(null);
            setDraft('');
            await list.refresh();
          }}>
          <h2>{heading}</h2>
          <label className="sa-field">
            {t('admin.title')}
            <input
              className="sa-input"
              name="title"
              required
              defaultValue={existing?.title}
            />
          </label>
          <label className="sa-field">
            {t('admin.language')}
            <select
              className="sa-select"
              name="locale"
              defaultValue={existing?.locale ?? ''}>
              <option value="">{t('admin.anyLanguage')}</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </label>
          <div className="sa-field">
            <span aria-hidden="true">{t('admin.body')}</span>
            <RichEditor
              ref={bodyRef}
              className="rt-dialog"
              label={t('admin.body')}
              value={draft}
              onChange={setDraft}
              t={t}
            />
            <span className="sa-fine">{t('admin.cannedVariables')}</span>
          </div>
          <div className="sa-dialog-foot">
            <button
              type="button"
              className="sa-btn"
              onClick={() => setEditing(null)}>
              {t('admin.cancel')}
            </button>
            <button type="submit" className="sa-btn sa-primary">
              {existing ? t('admin.save') : t('admin.create')}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
