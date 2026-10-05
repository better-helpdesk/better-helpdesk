import { useCallback, useEffect, useId, useState } from 'react';

import { type ApiError, useResource } from '../ui/api';
import { openCutoff } from '../ui/hours';
import { duration } from '../ui/i18n';
import { TYPE_ICONS } from '../ui/icons';
import { HELPDESK_CHANGED, useAdmin } from './context';
import { formatSnooze } from './snooze';
import {
  Avatar,
  Dialog,
  Empty,
  LoadError,
  paths,
  Select,
  Skeleton,
  Svg,
  useShortcuts,
  useToast,
  type Viewer,
  ViewerStack,
} from './ui';

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
  tags: string[];
  unread?: boolean;
  snoozedUntil?: string | null;
  preview?: string | null;
  contact?: { id: string; name: string | null; email: string | null };
  viewers?: Viewer[];
};

/** Hours waited before amber and red; open hours only, in an inbox with `hours`. */
const SOON_HOURS = 6;
const LATE_HOURS = 24;

export function Inbox() {
  const { api, t, me, route, navigate, inboxName, nav } = useAdmin();
  const [query, setQuery] = useState(route.q ?? '');
  const [tag, setTag] = useState(route.tag ?? '');
  const tagListId = useId();
  const filters = {
    inbox: route.inbox ?? '',
    status: route.status ?? 'open',
    assignee: route.assignee ?? '',
    q: route.q ?? '',
    tag: route.tag ?? '',
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
      api<{
        conversations: ConversationRow[];
        counts?: Record<'all' | 'mine' | 'unassigned', number>;
      }>(`agent/conversations?${params}`),
    params,
    10_000
  );
  const topTags = useResource(
    () => api<{ tags: string[] }>('agent/tags'),
    'tags'
  );
  const set = (key: string, value: string) =>
    navigate({ ...filters, [key]: value });
  useEffect(() => setTag(route.tag ?? ''), [route.tag]);
  useEffect(() => {
    const refresh = () => void list.refresh();
    window.addEventListener(HELPDESK_CHANGED, refresh);
    return () => window.removeEventListener(HELPDESK_CHANGED, refresh);
  }, [list.refresh]);
  // A new filter clears `list.data`; the tab counts hold until it lands.
  const [counts, setCounts] = useState(list.data?.counts);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    const listed = new Set(list.data?.conversations.map(c => c.id));
    setSelected(ids =>
      ids.every(id => listed.has(id)) ? ids : ids.filter(id => listed.has(id))
    );
  }, [list.data]);
  useEffect(() => {
    if (list.data?.counts) setCounts(list.data.counts);
  }, [list.data]);
  const all = list.data?.conversations ?? [];
  const urgent = all.filter(
    c => c.priority === 'high' || c.priority === 'urgent'
  );
  const rows = priority === 'high' ? urgent : all;
  const visibleSelected = selected.filter(id => rows.some(r => r.id === id));
  const filtered =
    Boolean(
      filters.assignee || filters.inbox || filters.q || filters.tag || priority
    ) || filters.status !== 'open';

  return (
    <div className="sa">
      <div className="sa-toolbar">
        <fieldset className="sa-seg" aria-label={t('admin.assignee')}>
          {(
            [
              ['', 'admin.all', 'all'],
              ['me', 'admin.mine', 'mine'],
              ['none', 'admin.unassigned', 'unassigned'],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.assignee === value}
              onClick={() => set('assignee', value)}>
              {t(label)}
              {counts && <span className="sa-count num"> {counts[count]}</span>}
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
        <form
          onSubmit={e => {
            e.preventDefault();
            set('tag', tag.trim().toLowerCase());
          }}>
          <input
            type="search"
            className="sa-input sa-tag-filter"
            aria-label={t('admin.tag')}
            placeholder={t('admin.tagFilter')}
            list={tagListId}
            value={tag}
            onChange={e => setTag(e.target.value)}
          />
          <datalist id={tagListId}>
            {(topTags.data?.tags ?? []).map(name => (
              <option key={name} value={name} />
            ))}
          </datalist>
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
          <option value="snoozed">
            {t('admin.status')}: {t('admin.snoozed')}
          </option>
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
        {!nav && <AwayControl />}
        {rows.length > 1 && (
          <span className="sa-kbd sa-hint">
            <kbd>j</kbd> <kbd>k</kbd> {t('admin.move')} · <kbd>x</kbd>{' '}
            {t('admin.select')} · <kbd>↵</kbd> {t('admin.open')} · <kbd>?</kbd>{' '}
            {t('admin.allShortcuts')}
          </span>
        )}
      </div>
      <p className="sa-sr-only" role="status">
        {visibleSelected.length > 0
          ? t('admin.selected', { count: String(visibleSelected.length) })
          : ''}
      </p>
      {list.error && <LoadError t={t} onRetry={list.refresh} />}
      {!list.data && !list.error && (
        <Skeleton kind="table" label={t('admin.loading')} />
      )}
      {list.data && rows.length === 0 && (
        <div className="sa-table-wrap">
          <Empty
            text={t(filtered ? 'admin.emptyFiltered' : 'admin.emptyInbox')}
            action={
              filtered && (
                <button
                  type="button"
                  className="sa-btn"
                  onClick={() => {
                    setQuery('');
                    setTag('');
                    navigate({});
                  }}>
                  {t('admin.clearFilters')}
                </button>
              )
            }
          />
        </div>
      )}
      {list.data && rows.length > 0 && (
        <ConversationTable
          rows={rows}
          hideStatus={filters.status !== 'any'}
          onTag={name => set('tag', name)}
          onOpen={id => navigate({ conversation: id })}
          selected={visibleSelected}
          onSelect={setSelected}
          keyboard
        />
      )}
      {visibleSelected.length > 0 && (
        <BulkBar
          rows={rows.filter(r => visibleSelected.includes(r.id))}
          tags={topTags.data?.tags ?? []}
          onClear={() => setSelected([])}
        />
      )}
    </div>
  );
}

/** The most conversations the server changes in one bulk request. */
const BULK_LIMIT = 100;

/** Applies one change to every selected conversation, all or none. */
function BulkBar({
  rows,
  tags,
  onClear,
}: {
  rows: ConversationRow[];
  tags: string[];
  onClear: () => void;
}) {
  const { api, t, me } = useAdmin();
  const [error, setError] = useState<string | null>(null);
  const [tag, setTag] = useState('');
  const tagListId = useId();
  const toast = useToast();
  const tooMany = rows.length > BULK_LIMIT;
  const agents = useResource(
    () =>
      api<{
        agents: { id: string; name: string | null; email: string | null }[];
      }>('agent/agents'),
    'agents'
  );
  const apply = async (change: {
    assigneeId?: string | null;
    status?: string;
    priority?: string;
    addTag?: string;
  }) => {
    if (tooMany) return;
    setError(null);
    try {
      await api('agent/conversations/bulk', {
        body: { ids: rows.map(r => r.id), ...change },
      });
      toast.show(t('admin.bulkDone'));
    } catch (e) {
      const failure = e as ApiError;
      const failed = rows.filter(r => failure.ids?.includes(r.id));
      setError(
        failed.length > 0
          ? t('admin.bulkFailedOn', {
              references: failed.map(r => r.reference).join(', '),
            })
          : failure.status === 400 && failure.message
            ? failure.message
            : t('admin.bulkError')
      );
    }
  };

  return (
    <>
      {error && (
        <p className="sa-error" role="alert">
          {error}
        </p>
      )}
      {tooMany && (
        <p className="sa-error" role="alert">
          {t('admin.bulkTooMany', { count: String(BULK_LIMIT) })}
        </p>
      )}
      {toast.node}
      <div
        className="sa-toolbar sa-bulk"
        role="toolbar"
        aria-label={t('admin.changeSelected')}>
        <span className="sa-count num" aria-hidden="true">
          {t('admin.selected', { count: String(rows.length) })}
        </span>
        <Select
          label={t('admin.assignee')}
          value=""
          placeholder
          options={['none', ...(agents.data?.agents.map(a => a.id) ?? [])]}
          render={id => {
            const agent = agents.data?.agents.find(a => a.id === id);
            return agent
              ? (agent.name ?? agent.email ?? id)
              : t('admin.unassigned');
          }}
          onChange={v => apply({ assigneeId: v === 'none' ? null : v })}
          disabled={tooMany}
        />
        <Select
          label={t('admin.status')}
          value=""
          placeholder
          options={me.statuses}
          render={s => t(`agentStatus.${s}`)}
          onChange={v => apply({ status: v })}
          disabled={tooMany}
        />
        <Select
          label={t('admin.priority')}
          value=""
          placeholder
          options={me.priorities}
          render={p => t(`priority.${p}`)}
          onChange={v => apply({ priority: v })}
          disabled={tooMany}
        />
        <form
          onSubmit={e => {
            e.preventDefault();
            const name = tag.trim().toLowerCase();
            if (!name) return;
            setTag('');
            void apply({ addTag: name });
          }}>
          <input
            className="sa-input sa-tag-filter"
            aria-label={t('admin.addTag')}
            placeholder={t('admin.addTag')}
            list={tagListId}
            maxLength={50}
            disabled={tooMany}
            value={tag}
            onChange={e => setTag(e.target.value)}
          />
          <datalist id={tagListId}>
            {tags.map(name => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </form>
        <button type="button" className="sa-btn sa-ghost" onClick={onClear}>
          {t('admin.clearSelection')}
        </button>
      </div>
    </>
  );
}

/** Setting yourself away changes what the widget and receipts promise. */
export function AwayControl() {
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
  onTag,
  selected,
  onSelect,
}: {
  rows: ConversationRow[];
  /** Adds a checkbox column; with shift, a box's change extends to the range from the last box toggled. */
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  /** Narrows the list to a tag; without it, row tags are plain labels. */
  onTag?: (tag: string) => void;
  /** When the list is filtered to one status, the column would repeat it. */
  hideStatus?: boolean;
  onOpen: (id: string) => void;
  /** On a contact's own page, where the column would repeat them. */
  hideContact?: boolean;
  /** j/k move, Enter opens; for the inbox, which owns the page. */
  keyboard?: boolean;
}) {
  const { t, href, locale, inboxName, me } = useAdmin();
  const now = new Date();
  const cutoffsByInbox = new Map<string, [number, number]>();
  const cutoffs = (inbox: string) => {
    let pair = cutoffsByInbox.get(inbox);
    if (!pair) {
      const hours = me.inboxHours[inbox];
      const before = (n: number) =>
        hours
          ? openCutoff(now, n, hours).getTime()
          : now.getTime() - n * 3_600_000;
      pair = [before(SOON_HOURS), before(LATE_HOURS)];
      cutoffsByInbox.set(inbox, pair);
    }
    return pair;
  };
  // By id: polling re-sorts the rows and a filter swaps them.
  const [activeId, setActiveId] = useState<string | null>(null);
  // -1 until the first j/k: the cursor shows only once someone uses it.
  const active = rows.findIndex(r => r.id === activeId);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const toggle = useCallback(
    (id: string, range: boolean) => {
      if (!selected || !onSelect) return;
      const from = rows.findIndex(r => r.id === anchorId);
      const to = rows.findIndex(r => r.id === id);
      const ids =
        range && from !== -1
          ? rows
              .slice(Math.min(from, to), Math.max(from, to) + 1)
              .map(r => r.id)
          : [id];
      onSelect(
        selected.includes(id)
          ? selected.filter(s => !ids.includes(s))
          : [...new Set([...selected, ...ids])]
      );
      setAnchorId(id);
    },
    [rows, selected, onSelect, anchorId]
  );
  const allSelected =
    rows.length > 0 && rows.every(r => selected?.includes(r.id));
  const someSelected = !allSelected && rows.some(r => selected?.includes(r.id));
  const showPriority = rows.some(
    r => r.priority === 'high' || r.priority === 'urgent'
  );

  const row = rows[active];
  const move = (to: number) => setActiveId(rows[to]?.id ?? null);
  useShortcuts(
    keyboard
      ? {
          j: () =>
            move(active === -1 ? 0 : Math.min(active + 1, rows.length - 1)),
          k: () => move(active === -1 ? 0 : Math.max(active - 1, 0)),
          Enter: () => row && onOpen(row.id),
          x: e => row && toggle(row.id, e.shiftKey),
        }
      : {}
  );

  return (
    <div className="sa-table-wrap">
      <table className="sa-table">
        <thead>
          <tr>
            {selected && (
              <th className="sa-check">
                <input
                  type="checkbox"
                  aria-label={t('admin.selectAll')}
                  checked={allSelected}
                  ref={el => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={() =>
                    onSelect?.(allSelected ? [] : rows.map(r => r.id))
                  }
                />
              </th>
            )}
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
            const since = waiting ? Date.parse(c.waitingSince as string) : 0;
            const [soon, late] = cutoffs(c.inbox);
            const tone = !waiting
              ? undefined
              : since < late
                ? 'late'
                : since < soon
                  ? 'soon'
                  : undefined;
            return (
              <tr
                key={c.id}
                data-unread={c.unread || undefined}
                data-active={keyboard && index === active}
                data-selected={selected?.includes(c.id) || undefined}
                onClick={e => {
                  if (!(e.target as Element).closest('.sa-check')) onOpen(c.id);
                }}>
                {selected && (
                  <td className="sa-check">
                    <input
                      type="checkbox"
                      aria-label={t('admin.selectRow', {
                        reference: c.reference,
                      })}
                      checked={selected.includes(c.id)}
                      onChange={e =>
                        toggle(c.id, (e.nativeEvent as MouseEvent).shiftKey)
                      }
                    />
                  </td>
                )}
                <td className="num">
                  {c.snoozedUntil &&
                  new Date(c.snoozedUntil).getTime() > Date.now() ? (
                    <span className="sa-pill">
                      {t('admin.snoozeUntil', {
                        date: formatSnooze(c.snoozedUntil, locale),
                      })}
                    </span>
                  ) : waiting ? (
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
                        {c.unread && (
                          <span className="sa-dot">
                            <span className="sa-sr-only">
                              {t('admin.unread')}{' '}
                            </span>
                          </span>
                        )}
                        <span className="num sa-fine">{c.reference}</span>{' '}
                        {c.subject ?? t(`agentType.${c.type}`)}
                      </a>
                      {c.preview &&
                        !c.preview.startsWith(
                          (c.subject ?? '').replace(/…$/, '')
                        ) && <span className="sa-preview">{c.preview}</span>}
                      <span className="sa-fine">
                        {t(`agentType.${c.type}`)} · {inboxName(c.inbox)}
                        {c.viewers?.length ? (
                          <ViewerStack t={t} viewers={c.viewers} />
                        ) : null}
                      </span>
                      {c.tags.length > 0 && (
                        <span className="sa-tags">
                          {c.tags.map(name =>
                            onTag ? (
                              <button
                                key={name}
                                type="button"
                                className="sa-pill sa-tag"
                                aria-label={`${t('admin.tagFilter')}: ${name}`}
                                onClick={e => {
                                  e.stopPropagation();
                                  onTag(name);
                                }}>
                                {name}
                              </button>
                            ) : (
                              <span key={name} className="sa-pill sa-tag">
                                {name}
                              </span>
                            )
                          )}
                        </span>
                      )}
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
