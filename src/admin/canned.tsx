import { useRef, useState } from 'react';

import { useResource } from '../ui/api';
import { RichText } from '../ui/rich';
import { RichEditor, type RichEditorHandle } from '../ui/rich-editor';
import { useAdmin } from './context';
import { Dialog, Empty, paths, Svg } from './ui';

export function CannedReplies() {
  const { api, t } = useAdmin();
  const list = useResource(
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
  const [creating, setCreating] = useState(false);
  const bodyRef = useRef<RichEditorHandle>(null);
  const [draft, setDraft] = useState('');

  return (
    <div className="sa">
      <div className="sa-toolbar">
        <span className="sa-grow" />
        <button
          type="button"
          className="sa-btn sa-primary"
          onClick={() => setCreating(true)}>
          <Svg d={paths.plus} />
          {t('admin.newCanned')}
        </button>
      </div>
      {list.data?.replies.length === 0 && (
        <div className="sa-table-wrap">
          <Empty text={t('admin.emptyCanned')} />
        </div>
      )}
      {list.data?.replies.map(r => (
        <div key={r.id} className="sa-card">
          <div className="sa-toolbar">
            <strong className="sa-grow">
              {r.title}{' '}
              {r.locale && (
                <span className="sa-pill">{r.locale.toUpperCase()}</span>
              )}
            </strong>
            <button
              type="button"
              className="sa-btn sa-ghost sa-danger"
              onClick={async () => {
                if (!window.confirm(t('admin.confirmDelete'))) return;
                await api(`agent/canned/${r.id}`, { method: 'DELETE' });
                await list.refresh();
              }}>
              {t('admin.delete')}
            </button>
          </div>
          <div className="sa-muted">
            <RichText text={r.body} />
          </div>
        </div>
      ))}
      <Dialog
        open={creating}
        title={t('admin.newCanned')}
        onClose={() => setCreating(false)}>
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!draft.trim()) {
              bodyRef.current?.focus();
              return;
            }
            const form = new FormData(e.currentTarget);
            await api('agent/canned', {
              body: {
                title: String(form.get('title') ?? '').trim(),
                body: draft.trim(),
                locale: String(form.get('locale') ?? '') || null,
              },
            });
            setCreating(false);
            setDraft('');
            await list.refresh();
          }}>
          <h2>{t('admin.newCanned')}</h2>
          <label className="sa-field">
            {t('admin.title')}
            <input className="sa-input" name="title" required />
          </label>
          <label className="sa-field">
            {t('admin.language')}
            <select className="sa-select" name="locale" defaultValue="">
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
              onClick={() => setCreating(false)}>
              {t('admin.cancel')}
            </button>
            <button type="submit" className="sa-btn sa-primary">
              {t('admin.create')}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
