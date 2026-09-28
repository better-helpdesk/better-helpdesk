import { useEffect, useState } from 'react';

import { useResource } from '../ui/api';
import { duration } from '../ui/i18n';
import { TYPE_ICONS } from '../ui/icons';
import { HELPDESK_CHANGED, useAdmin } from './context';
import { Avatar, Dialog, paths, Svg } from './ui';

export type ConversationRow = {
  id: string;
  reference: string;
  subject: string | null;
  type: string;
  status: string;
  priority: string;
  inbox: string;
  waitingSince: string | null;
  lastMessageAt: string;
  assigneeId: string | null;
  preview?: string | null;
  contact?: { id: string; name: string | null; email: string | null };
};

/** The widget promises a reply within a business day; amber warns ahead of it, red is past it. */
const SOON_HOURS = 6;
const LATE_HOURS = 24;

export function Inbox() {
  const { api, t, me, route, navigate, inboxName } = useAdmin();
  const [query, setQuery] = useState(route.q ?? '');
  const filters = {
    inbox: route.inbox ?? '',
    status: route.status ?? 'open',
    assignee: route.assignee ?? '',
    q: route.q ?? '',
    sort: route.sort ?? '',
    priority: route.priority ?? '',
  };
  // Priority narrows the fetched list here, so its count stays visible when off.
  const { priority, ...serverFilters } = filters;
  const params = new URLSearchParams(
    Object.entries(serverFilters).filter(([, v]) => v !== '' && v !== 'any')
  ).toString();
  const list = useResource(
    () =>
      api<{ conversations: ConversationRow[] }>(
        `agent/conversations?${params}`
      ),
    params,
    10_000
  );
  const set = (key: string, value: string) =>
    navigate({ ...filters, [key]: value });
  useEffect(() => {
    const refresh = () => void list.refresh();
    window.addEventListener(HELPDESK_CHANGED, refresh);
    return () => window.removeEventListener(HELPDESK_CHANGED, refresh);
  }, [list.refresh]);
  const all = list.data?.conversations ?? [];
  const urgent = all.filter(
    c => c.priority === 'high' || c.priority === 'urgent'
  );
  const rows = priority === 'high' ? urgent : all;

  return (
    <div className="sa">
      <div className="sa-toolbar">
        <fieldset className="sa-seg" aria-label={t('admin.assignee')}>
          {(
            [
              ['', 'admin.all'],
              ['me', 'admin.mine'],
              ['none', 'admin.unassigned'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.assignee === value}
              onClick={() => set('assignee', value)}>
              {t(label)}
            </button>
          ))}
        </fieldset>
        {(urgent.length > 0 || priority === 'high') && (
          <button
            type="button"
            className="sa-btn sa-chip sa-chip-warn"
            aria-pressed={priority === 'high'}
            onClick={() => set('priority', priority === 'high' ? '' : 'high')}>
            {t('admin.highCount', { count: String(urgent.length) })}
          </button>
        )}
        <form
          className="sa-grow"
          onSubmit={e => {
            e.preventDefault();
            set('q', query);
          }}>
          <input
            type="search"
            className="sa-input"
            aria-label={t('admin.search')}
            placeholder={t('admin.search')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </form>
        <select
          className="sa-select"
          aria-label={t('admin.inboxLabel')}
          value={filters.inbox}
          onChange={e => set('inbox', e.target.value)}>
          <option value="">{t('admin.allInboxes')}</option>
          {me.inboxes.map(i => (
            <option key={i} value={i}>
              {inboxName(i)}
            </option>
          ))}
        </select>
        <select
          className="sa-select"
          aria-label={t('admin.status')}
          value={filters.status}
          onChange={e => set('status', e.target.value)}>
          <option value="any">
            {t('admin.status')}: {t('admin.all')}
          </option>
          {me.statuses.map(s => (
            <option key={s} value={s}>
              {t('admin.status')}: {t(`agentStatus.${s}`)}
            </option>
          ))}
        </select>
        <select
          className="sa-select"
          aria-label={t('admin.sort')}
          value={filters.sort}
          onChange={e => set('sort', e.target.value)}>
          <option value="">
            {t('admin.sort')}: {t('admin.sortWaiting')}
          </option>
          <option value="priority">
            {t('admin.sort')}: {t('admin.sortPriority')}
          </option>
        </select>
        <AwayControl />
        {rows.length > 1 && (
          <span className="sa-kbd sa-hint">
            <kbd>j</kbd> <kbd>k</kbd> {t('admin.move')} · <kbd>↵</kbd>{' '}
            {t('admin.open')}
          </span>
        )}
      </div>
      {list.error && <p className="sa-error">{t('admin.error')}</p>}
      {!list.data && !list.error && (
        <div className="sa-table-wrap" aria-busy="true">
          <p className="sa-empty">{t('admin.loading')}</p>
        </div>
      )}
      {list.data && (
        <ConversationTable
          rows={rows}
          hideStatus={filters.status !== 'any'}
          onOpen={id => navigate({ conversation: id })}
          keyboard
        />
      )}
    </div>
  );
}

/** Setting yourself away changes what the widget and receipts promise. */
function AwayControl() {
  const { api, t, me, refreshMe, locale } = useAdmin();
  const [open, setOpen] = useState(false);
  const until = me.agent.awayUntil ? new Date(me.agent.awayUntil) : null;
  const save = async (awayUntil: string | null) => {
    await api('agent/me', { method: 'PATCH', body: { awayUntil } });
    await refreshMe();
    setOpen(false);
  };

  if (until && until.getTime() > Date.now()) {
    return (
      <button
        type="button"
        className="sa-btn sa-chip"
        aria-pressed="true"
        title={t('admin.awayEnd')}
        onClick={() => save(null)}>
        {t('admin.awayUntil', {
          date: until.toLocaleDateString(locale === 'de' ? 'de-CH' : 'en-GB'),
        })}
        <Svg d={paths.x} />
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        className="sa-btn sa-ghost"
        onClick={() => setOpen(true)}>
        {t('admin.setAway')}
      </button>
      <Dialog
        open={open}
        title={t('admin.setAway')}
        onClose={() => setOpen(false)}>
        <form
          onSubmit={e => {
            e.preventDefault();
            const day = String(new FormData(e.currentTarget).get('until'));
            // Away through the whole of that day, in the agent's own time zone.
            void save(new Date(`${day}T23:59:59`).toISOString());
          }}>
          <h2>{t('admin.setAway')}</h2>
          <p className="sa-muted">{t('admin.awayHint')}</p>
          <label className="sa-field">
            {t('admin.awayLastDay')}
            <input
              className="sa-input"
              type="date"
              name="until"
              required
              min={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <div className="sa-dialog-foot">
            <button
              type="button"
              className="sa-btn"
              onClick={() => setOpen(false)}>
              {t('admin.cancel')}
            </button>
            <button type="submit" className="sa-btn sa-primary">
              {t('admin.save')}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function ConversationTable({
  rows,
  onOpen,
  keyboard = false,
  hideContact = false,
  hideStatus = false,
}: {
  rows: ConversationRow[];
  /** When the list is filtered to one status, the column would repeat it. */
  hideStatus?: boolean;
  onOpen: (id: string) => void;
  /** On a contact's own page, where the column would repeat them. */
  hideContact?: boolean;
  /** j/k move, Enter opens; for the inbox, which owns the page. */
  keyboard?: boolean;
}) {
  const { t, href, locale, inboxName } = useAdmin();
  // By id: polling re-sorts the rows and a filter swaps them.
  const [activeId, setActiveId] = useState<string | null>(null);
  // -1 until the first j/k: the cursor shows only once someone uses it.
  const active = rows.findIndex(r => r.id === activeId);
  const showPriority = rows.some(
    r => r.priority === 'high' || r.priority === 'urgent'
  );

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName) ||
        target.closest('[role="tab"], [role="dialog"]')
      ) {
        return;
      }
      const row = rows[active];
      const move = (to: number) => setActiveId(rows[to]?.id ?? null);
      if (e.key === 'j')
        move(active === -1 ? 0 : Math.min(active + 1, rows.length - 1));
      else if (e.key === 'k') move(active === -1 ? 0 : Math.max(active - 1, 0));
      else if (e.key === 'Enter' && row) onOpen(row.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard, rows, active, onOpen]);

  if (rows.length === 0) {
    return (
      <div className="sa-table-wrap">
        <p className="sa-empty">{t('admin.empty')}</p>
      </div>
    );
  }

  return (
    <div className="sa-table-wrap">
      <table className="sa-table">
        <thead>
          <tr>
            <th>{t('admin.waitingCol')}</th>
            <th>{t('admin.subjectCol')}</th>
            {!hideContact && <th>{t('admin.contact')}</th>}
            {!hideStatus && <th>{t('admin.status')}</th>}
            {showPriority && <th>{t('admin.priority')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, index) => {
            const waiting = Boolean(c.waitingSince) && c.status !== 'resolved';
            const hours = waiting
              ? (Date.now() - new Date(c.waitingSince as string).getTime()) /
                3_600_000
              : 0;
            const tone =
              hours > LATE_HOURS
                ? 'late'
                : hours > SOON_HOURS
                  ? 'soon'
                  : undefined;
            return (
              <tr
                key={c.id}
                className={waiting ? 'sa-waiting' : undefined}
                data-active={keyboard && index === active}
                onClick={() => onOpen(c.id)}>
                <td className="num">
                  {waiting ? (
                    <span className="sa-pill" data-tone={tone}>
                      {duration(c.waitingSince as string, locale)}
                    </span>
                  ) : (
                    <span className="sa-fine">—</span>
                  )}
                </td>
                <td>
                  <div className="sa-cell">
                    <span
                      className="sa-type"
                      data-type={c.type}
                      title={t(`agentType.${c.type}`)}>
                      <Svg
                        d={TYPE_ICONS[c.type] ?? TYPE_ICONS.question ?? ''}
                      />
                    </span>
                    <div className="sa-cell-title">
                      <a
                        href={href({ conversation: c.id })}
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          onOpen(c.id);
                        }}>
                        <span className="num sa-fine">{c.reference}</span>{' '}
                        {c.subject ?? t(`agentType.${c.type}`)}
                      </a>
                      {c.preview &&
                        !c.preview.startsWith(
                          (c.subject ?? '').replace(/…$/, '')
                        ) && <span className="sa-preview">{c.preview}</span>}
                      <span className="sa-fine">
                        {t(`agentType.${c.type}`)} · {inboxName(c.inbox)}
                      </span>
                    </div>
                  </div>
                </td>
                {!hideContact && (
                  <td>
                    {c.contact && (
                      <span className="sa-who">
                        <Avatar name={c.contact.name ?? c.contact.email} />
                        <span>{c.contact.name ?? c.contact.email}</span>
                      </span>
                    )}
                  </td>
                )}
                {!hideStatus && (
                  <td>
                    <span className="sa-pill" data-status={c.status}>
                      {t(`agentStatus.${c.status}`)}
                    </span>
                  </td>
                )}
                {showPriority && (
                  <td>
                    {(c.priority === 'high' || c.priority === 'urgent') && (
                      <span className="sa-pill" data-tone={c.priority}>
                        {t(`priority.${c.priority}`)}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
