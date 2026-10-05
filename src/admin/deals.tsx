import { useState } from 'react';

import { useResource } from '../ui/api';
import { duration } from '../ui/i18n';
import { useAdmin } from './context';
import { Dialog, Empty, money, paths, Svg } from './ui';

/** A deal this long in one stage is flagged for a nudge. */
const STALE_DAYS = 14;

type Deal = {
  id: string;
  title: string;
  stage: string;
  value: string | null;
  currency: string;
  companyId: string | null;
  companyName: string | null;
  contactName: string | null;
  expectedCloseAt: string | null;
  createdAt: string;
  stageChangedAt: string;
};

export function DealsBoard() {
  const { api, t, me, locale } = useAdmin();
  const deals = useResource(
    () => api<{ deals: Deal[] }>('agent/deals'),
    'deals'
  );
  const [over, setOver] = useState<string | null>(null);
  const [editing, setEditing] = useState<Deal | 'new' | null>(null);
  const [error, setError] = useState(false);

  const move = async (id: string, stage: string) => {
    deals.setData(
      current =>
        current && {
          deals: current.deals.map(d => (d.id === id ? { ...d, stage } : d)),
        }
    );
    setError(false);
    try {
      await api(`agent/deals/${id}`, { method: 'PATCH', body: { stage } });
    } catch {
      setError(true);
    } finally {
      // Puts the card back where the server has it when the move failed.
      await deals.refresh();
    }
  };

  const none = deals.data?.deals.length === 0;

  return (
    <div className="sa">
      <div className="sa-toolbar">
        {error && <p className="sa-error">{t('admin.error')}</p>}
        <span className="sa-grow" />
        <button
          type="button"
          className="sa-btn sa-primary"
          onClick={() => setEditing('new')}>
          <Svg d={paths.plus} />
          {t('admin.newDeal')}
        </button>
      </div>
      {none && <Empty text={t('admin.emptyDeals')} />}
      <div
        className="sa-board"
        style={{ '--cols': me.dealStages.length } as React.CSSProperties}>
        {me.dealStages.map(stage => {
          const inStage =
            deals.data?.deals.filter(d => d.stage === stage) ?? [];
          const total = inStage.reduce(
            (sum, d) => sum + Number(d.value ?? 0),
            0
          );
          return (
            <section
              key={stage}
              className="sa-column"
              data-over={over === stage}
              aria-label={t(`stage.${stage}`)}
              onDragOver={e => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={e => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData('text/plain');
                if (id) void move(id, stage);
              }}>
              <div className="sa-column-head">
                <span>
                  {t(`stage.${stage}`)}{' '}
                  <span className="sa-fine">{inStage.length}</span>
                </span>
                <span className="num sa-fine">
                  {money(String(total), 'CHF', locale)}
                </span>
              </div>
              {inStage.length === 0 && !none && (
                <p className="sa-drop-hint">{t('admin.dropDeal')}</p>
              )}
              {inStage.map(d => (
                <button
                  key={d.id}
                  type="button"
                  className="sa-deal"
                  draggable
                  onDragStart={e => e.dataTransfer.setData('text/plain', d.id)}
                  onClick={() => setEditing(d)}>
                  <strong>{d.title}</strong>
                  {(d.companyName || d.contactName) && (
                    <span className="sa-muted">
                      {[d.companyName, d.contactName]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                  <span className="sa-toolbar">
                    <span className="num sa-grow">
                      {money(d.value, d.currency, locale)}
                    </span>
                    <span
                      className="sa-fine"
                      data-stale={
                        Date.now() - new Date(d.stageChangedAt).getTime() >
                          STALE_DAYS * 86_400_000 || undefined
                      }>
                      {t('admin.inStage', {
                        duration: duration(d.stageChangedAt, locale),
                      })}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          );
        })}
      </div>
      <DealDialog
        deal={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await deals.refresh();
        }}
      />
    </div>
  );
}

export function DealDialog({
  deal,
  defaults = {},
  onClose,
  onSaved,
}: {
  deal: Deal | 'new' | null;
  /** Links a new deal to the page it was created from. */
  defaults?: { contactId?: string; companyId?: string | null };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { api, t, me } = useAdmin();
  const existing = deal && deal !== 'new' ? deal : null;
  return (
    <Dialog
      open={deal !== null}
      title={existing ? t('admin.editDeal') : t('admin.newDeal')}
      onClose={onClose}>
      <form
        key={existing?.id ?? 'new'}
        onSubmit={async e => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const value = String(form.get('value') ?? '');
          const close = String(form.get('expectedCloseAt') ?? '');
          const body = {
            title: String(form.get('title') ?? '').trim(),
            stage: String(form.get('stage')),
            value: value === '' ? null : Number(value),
            expectedCloseAt: close ? new Date(close).toISOString() : null,
          };
          if (existing) {
            await api(`agent/deals/${existing.id}`, { method: 'PATCH', body });
          } else {
            await api('agent/deals', {
              body: {
                ...body,
                contactId: defaults.contactId,
                companyId: defaults.companyId ?? undefined,
              },
            });
          }
          await onSaved();
        }}>
        <h2>{existing ? t('admin.editDeal') : t('admin.newDeal')}</h2>
        <label className="sa-field">
          {t('admin.dealTitle')}
          <input
            className="sa-input"
            name="title"
            required
            defaultValue={existing?.title}
          />
        </label>
        <div className="sa-grid">
          <label className="sa-field">
            {t('admin.stage')}
            <select
              className="sa-select"
              style={{ width: '100%' }}
              name="stage"
              defaultValue={existing?.stage ?? me.dealStages[0]}>
              {me.dealStages.map(s => (
                <option key={s} value={s}>
                  {t(`stage.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="sa-field">
            {t('admin.value')} (CHF)
            <input
              className="sa-input num"
              name="value"
              type="number"
              min={0}
              defaultValue={existing?.value ?? ''}
            />
          </label>
          <label className="sa-field">
            {t('admin.closeDate')}
            <input
              className="sa-input"
              name="expectedCloseAt"
              type="date"
              defaultValue={existing?.expectedCloseAt?.slice(0, 10) ?? ''}
            />
          </label>
        </div>
        <div className="sa-dialog-foot">
          {existing && (
            <button
              type="button"
              className="sa-btn sa-danger"
              style={{ marginRight: 'auto' }}
              onClick={async () => {
                if (!window.confirm(t('admin.confirmDelete'))) return;
                await api(`agent/deals/${existing.id}`, { method: 'DELETE' });
                await onSaved();
              }}>
              {t('admin.delete')}
            </button>
          )}
          <button type="button" className="sa-btn" onClick={onClose}>
            {t('admin.cancel')}
          </button>
          <button type="submit" className="sa-btn sa-primary">
            {t('admin.save')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
