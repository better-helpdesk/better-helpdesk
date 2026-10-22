import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { type ApiError, useResource } from '../ui/api';
import { openCutoff } from '../ui/hours';
import { duration, nextWorkday } from '../ui/i18n';
import { TYPE_ICONS } from '../ui/icons';
import { RichEditor } from '../ui/rich-editor';
import { HELPDESK_CHANGED, type Route, useAdmin } from './context';
import { NewConversationDialog } from './new-conversation';
import { NotificationBell } from './notifications';
import { formatSnooze, localInput } from './snooze';
import {
  Avatar,
  Dialog,
  DueChip,
  Empty,
  LoadError,
  paths,
  RatingChip,
  Select,
  Skeleton,
  Svg,
  setQueueOn,
  useKeysOn,
  useNarrow,
  useQueueOn,
  useShortcuts,
  useToast,
  type Viewer,
  ViewerStack,
} from './ui';
import { SavedViews } from './views';

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
  tier?: string | null;
  channel?: string;
  slaDueAt?: string | null;
  unread?: boolean;
  snoozedUntil?: string | null;
  rating?: 'good' | 'bad' | null;
  ratingScore?: number | null;
  preview?: string | null;
  contact?: { id: string; name: string | null; email: string | null };
  viewers?: Viewer[];
};

/** Hours waited before amber and red; open hours only, in an inbox with `hours`. */
const SOON_HOURS = 6;
const LATE_HOURS = 24;

export function Inbox() {
  const {
    api,
    t,
    me,
    route,
    navigate,
    inboxName,
    nav,
    readOnly,
    openShortcuts,
    setQueue,
  } = useAdmin();
  const queueOn = useQueueOn();
  const keysOn = useKeysOn();
  const [query, setQuery] = useState(route.q ?? '');
  const [tag, setTag] = useState(route.tag ?? '');
  const tagListId = useId();
  const tagInputId = useId();
  const moreId = useId();
  const [moreOpen, setMoreOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  // Beside an open thread the list is a narrow pane: the bar keeps the tabs and
  // the icon buttons, and the tray under it takes the search and the rest.
  const root = useRef<HTMLDivElement>(null);
  const narrow = useNarrow(root, 720);
  const filters = {
    inbox: route.inbox ?? '',
    status: route.status ?? 'open',
    assignee: route.assignee ?? '',
    q: route.q ?? '',
    tag: route.tag ?? '',
    sort: route.sort ?? '',
    priority: route.priority ?? '',
    days: route.days ?? '',
    tier: route.tier ?? '',
    channel: route.channel ?? '',
  };
  const { priority } = filters;
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== 'any')
  ).toString();
  const list = useResource(
    () =>
      api<{
        conversations: ConversationRow[];
        counts?: Record<'all' | 'mine' | 'unassigned', number>;
      }>(`agent/conversations?${params}`),
    params,
    me.realtime ? 60_000 : 10_000
  );
  const topTags = useResource(
    () => api<{ tags: string[] }>('agent/tags'),
    'tags'
  );
  // A filter changes the list beside an open conversation, not the conversation.
  const thread: Route = route.conversation
    ? { conversation: route.conversation }
    : {};
  const set = (key: string, value: string) =>
    navigate({ ...filters, [key]: value, ...thread });
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
  const top = me.priorities.slice(-2);
  const urgent = all.filter(c => top.includes(c.priority));
  const rows = all;
  useEffect(() => {
    const next = rows.map(r => ({
      id: r.id,
      viewed: Boolean(r.viewers?.length),
    }));
    const key = (entries: typeof next) =>
      entries.map(e => `${e.id}${e.viewed ? '*' : ''}`).join(' ');
    // Polling hands over new rows every time; only a changed order is news.
    setQueue(current => (key(current) === key(next) ? current : next));
  });
  // Status, inbox, tag, sort and priority sit in the tray, which opens when one of them is set.
  const trayActive = [
    filters.status !== 'open',
    filters.inbox,
    filters.tag,
    filters.sort,
    filters.days,
    filters.tier,
    filters.channel,
  ].filter(Boolean).length;
  const anyMore = trayActive > 0;
  useEffect(() => {
    if (anyMore) setMoreOpen(true);
  }, [anyMore]);
  // The search and its chip count once they are in the tray too, out of sight.
  const moreActive =
    trayActive + (narrow ? [filters.q, priority].filter(Boolean).length : 0);
  const visibleSelected = selected.filter(id => rows.some(r => r.id === id));
  const filtered =
    Boolean(
      filters.assignee ||
        filters.inbox ||
        filters.q ||
        filters.tag ||
        priority ||
        filters.days ||
        filters.tier ||
        filters.channel
    ) || filters.status !== 'open';
  const clear = () => {
    setQuery('');
    setTag('');
    navigate(thread);
  };
  // High and urgent narrows the list as the search does, so it sits beside it in the bar or the tray.
  const search = (
    <>
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
      {(urgent.length > 0 || priority === 'high') && (
        <button
          type="button"
          className="sa-btn sa-chip sa-chip-warn"
          aria-pressed={priority === 'high'}
          onClick={() => set('priority', priority === 'high' ? '' : 'high')}>
          {t('admin.highCount', { count: String(urgent.length) })}
        </button>
      )}
    </>
  );

  return (
    <div className="sa" ref={root}>
      <div className="sa-toolbar sa-bar" data-narrow={narrow || undefined}>
        <fieldset className="sa-seg" aria-label={t('admin.assignee')}>
          {(
            [
              ['', 'admin.all', 'admin.all', 'all'],
              ['me', 'admin.mine', 'admin.mineShort', 'mine'],
              [
                'none',
                'admin.unassigned',
                'admin.unassignedShort',
                'unassigned',
              ],
            ] as const
          ).map(([value, label, short, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.assignee === value}
              title={narrow ? t(label) : undefined}
              onClick={() => set('assignee', value)}>
              {t(narrow ? short : label)}
              {counts && <span className="sa-count num"> {counts[count]}</span>}
            </button>
          ))}
        </fieldset>
        {!narrow && search}
        <button
          type="button"
          className="sa-btn"
          aria-expanded={moreOpen}
          aria-controls={moreId}
          onClick={() => setMoreOpen(!moreOpen)}>
          <Svg d={paths.filter} />
          <span className={narrow ? 'sa-sr-only' : undefined}>
            {t('admin.filters')}
          </span>
          {moreActive > 0 && <span className="sa-count num">{moreActive}</span>}
        </button>
        {!readOnly && (
          <button
            type="button"
            className="sa-btn"
            title={t('admin.newConversation')}
            onClick={() => setStarting(true)}>
            <Svg d={paths.plus} />
            <span className={narrow ? 'sa-sr-only' : undefined}>
              {t('admin.newConversation')}
            </span>
          </button>
        )}
        {!nav && <NotificationBell />}
        {!nav && !narrow && <AwayControl />}
      </div>
      <SavedViews filters={filters} canSave={filtered}>
        {(chips, actions) => (
          <div id={moreId} className="sa-filters" hidden={!moreOpen}>
            {narrow && (
              <div className="sa-filters-wide sa-toolbar">{search}</div>
            )}
            {chips && <div className="sa-filters-wide">{chips}</div>}
            {filters.days && (
              <div className="sa-filters-wide sa-toolbar">
                <button
                  type="button"
                  className="sa-btn sa-chip"
                  aria-pressed="true"
                  onClick={() => set('days', '')}>
                  {t('admin.lastDays', { count: filters.days })}
                  <Svg d={paths.x} />
                </button>
              </div>
            )}
            <label className="sa-field">
              {t('admin.status')}
              <select
                className="sa-select"
                value={filters.status}
                onChange={e => set('status', e.target.value)}>
                <option value="any">{t('admin.all')}</option>
                {me.statuses.map(s => (
                  <option key={s} value={s}>
                    {t(`agentStatus.${s}`)}
                  </option>
                ))}
                <option value="snoozed">{t('admin.snoozed')}</option>
                <option value="rated-good">{t('admin.rated.good')}</option>
                <option value="rated-bad">{t('admin.rated.bad')}</option>
              </select>
            </label>
            <label className="sa-field">
              {t('admin.inboxLabel')}
              <select
                className="sa-select"
                value={filters.inbox}
                onChange={e => set('inbox', e.target.value)}>
                <option value="">{t('admin.allInboxes')}</option>
                {me.inboxes.map(i => (
                  <option key={i} value={i}>
                    {inboxName(i)}
                  </option>
                ))}
              </select>
            </label>
            <form
              className="sa-field"
              onSubmit={e => {
                e.preventDefault();
                set('tag', tag.trim().toLowerCase());
              }}>
              <label htmlFor={tagInputId}>{t('admin.tag')}</label>
              <input
                id={tagInputId}
                type="search"
                className="sa-input"
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
            {me.tiers.length > 0 && (
              <label className="sa-field">
                {t('admin.tier')}
                <select
                  className="sa-select"
                  value={filters.tier}
                  onChange={e => set('tier', e.target.value)}>
                  <option value="">{t('admin.allTiers')}</option>
                  {me.tiers.map(tier => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="sa-field">
              {t('admin.channel')}
              <select
                className="sa-select"
                value={filters.channel}
                onChange={e => set('channel', e.target.value)}>
                <option value="">{t('admin.allChannels')}</option>
                {me.channels.map(channel => (
                  <option key={channel} value={channel}>
                    {t(`channel.${channel}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="sa-field">
              {t('admin.sort')}
              <select
                className="sa-select"
                value={filters.sort}
                onChange={e => set('sort', e.target.value)}>
                <option value="">{t('admin.sortWaiting')}</option>
                <option value="priority">{t('admin.sortPriority')}</option>
                {me.sla && <option value="sla">{t('admin.sortSla')}</option>}
              </select>
            </label>
            <div className="sa-filters-wide sa-filters-foot">
              <label className="sa-toggle">
                <input
                  type="checkbox"
                  checked={queueOn}
                  onChange={e => setQueueOn(e.target.checked)}
                />
                {t('admin.workQueue')}
              </label>
              {!nav && narrow && <AwayControl />}
              <span className="sa-grow" />
              {!keysOn ? (
                <button
                  type="button"
                  className="sa-btn sa-ghost"
                  onClick={openShortcuts}>
                  {t('admin.shortcuts')}
                </button>
              ) : (
                rows.length > 1 && (
                  <span className="sa-kbd sa-hint">
                    <kbd>j</kbd> <kbd>k</kbd> {t('admin.move')} · <kbd>x</kbd>{' '}
                    {t('admin.select')} · <kbd>↵</kbd> {t('admin.open')} ·{' '}
                    <kbd>?</kbd> {t('admin.allShortcuts')}
                  </span>
                )
              )}
              {actions}
            </div>
          </div>
        )}
      </SavedViews>
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
                <button type="button" className="sa-btn" onClick={clear}>
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
          hideStatus={filters.status !== 'any' || Boolean(route.conversation)}
          hideContact={Boolean(route.conversation)}
          onTag={name => set('tag', name)}
          onOpen={id => navigate({ ...route, conversation: id })}
          selected={readOnly ? undefined : visibleSelected}
          onSelect={readOnly ? undefined : setSelected}
          keyboard
        />
      )}
      {!readOnly && visibleSelected.length > 0 && (
        <BulkBar
          rows={rows.filter(r => visibleSelected.includes(r.id))}
          tags={topTags.data?.tags ?? []}
          onClear={() => setSelected([])}
        />
      )}
      <NewConversationDialog
        open={starting}
        onClose={() => setStarting(false)}
        onCreated={id => {
          setStarting(false);
          navigate({ ...route, conversation: id });
        }}
      />
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
  const { api, t, me, priorityName } = useAdmin();
  const [error, setError] = useState<string | null>(null);
  const [tag, setTag] = useState('');
  const [writing, setWriting] = useState<'reply' | 'note' | null>(null);
  const [text, setText] = useState('');
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
    reply?: string;
    note?: string;
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
          render={priorityName}
          onChange={v => apply({ priority: v })}
          disabled={tooMany}
        />
        <button
          type="button"
          className="sa-btn"
          disabled={tooMany}
          onClick={() => setWriting('reply')}>
          {t('admin.bulkReply')}
        </button>
        <button
          type="button"
          className="sa-btn"
          disabled={tooMany}
          onClick={() => setWriting('note')}>
          {t('admin.bulkNote')}
        </button>
        <Dialog
          open={writing !== null}
          title={t(writing === 'note' ? 'admin.bulkNote' : 'admin.bulkReply')}
          onClose={() => setWriting(null)}>
          <form
            onSubmit={async e => {
              e.preventDefault();
              const body = text.trim();
              if (!body) return;
              const kind = writing;
              setWriting(null);
              setText('');
              await apply(kind === 'note' ? { note: body } : { reply: body });
            }}>
            <h2>
              {t(writing === 'note' ? 'admin.bulkNote' : 'admin.bulkReply')}
            </h2>
            <p className="sa-muted">{t('admin.bulkReplyHint')}</p>
            <div className="sa-field">
              <span aria-hidden="true">
                {t(writing === 'note' ? 'admin.note' : 'admin.reply')}
              </span>
              <RichEditor
                className="rt-dialog"
                label={t(writing === 'note' ? 'admin.note' : 'admin.reply')}
                value={text}
                onChange={setText}
                t={t}
              />
            </div>
            <div className="sa-dialog-foot">
              <button
                type="button"
                className="sa-btn"
                onClick={() => setWriting(null)}>
                {t('admin.cancel')}
              </button>
              <button type="submit" className="sa-btn sa-primary">
                {t('admin.send')}
              </button>
            </div>
          </form>
        </Dialog>
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

/** Nine the next weekday morning: the usual answer to "back when?". */
function nextMorning() {
  const next = nextWorkday(new Date());
  next.setHours(9, 0, 0, 0);
  return next;
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
        {t('admin.awayUntil', { date: formatSnooze(until, locale) })}
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
            const back = String(new FormData(e.currentTarget).get('until'));
            // A datetime-local value reads as the agent's own time zone.
            void save(new Date(back).toISOString());
          }}>
          <h2>{t('admin.setAway')}</h2>
          <p className="sa-muted">{t('admin.awayHint')}</p>
          <label className="sa-field">
            {t('admin.awayBack')}
            <input
              className="sa-input"
              type="datetime-local"
              name="until"
              required
              min={localInput(new Date())}
              defaultValue={localInput(nextMorning())}
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
  const { t, href, locale, inboxName, priorityName, me, route } = useAdmin();
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
  // -1 until the first j/k or an open thread: the cursor shows only once someone uses it.
  const active = rows.findIndex(r => r.id === (activeId ?? route.conversation));
  const wrap = useRef<HTMLDivElement>(null);
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
  // The two highest priorities are the ones worth a column and a colour.
  const top = me.priorities.slice(-2);
  const showPriority = rows.some(r => top.includes(r.priority));

  const row = rows[active];
  const move = (to: number) => setActiveId(rows[to]?.id ?? null);
  const open = (id: string) => {
    setActiveId(id);
    onOpen(id);
  };
  // A narrow container hides the list behind an open thread, and its keys go with it.
  const shown = (run: (e: KeyboardEvent) => void) => (e: KeyboardEvent) => {
    if (wrap.current?.checkVisibility?.() !== false) run(e);
  };
  useShortcuts(
    keyboard
      ? {
          j: shown(() =>
            move(active === -1 ? 0 : Math.min(active + 1, rows.length - 1))
          ),
          k: shown(() => move(active === -1 ? 0 : Math.max(active - 1, 0))),
          // Enter on a control in the open thread is that control's.
          Enter: shown(e => {
            const target = e.composedPath()[0];
            if (
              target instanceof Element &&
              target.closest('button, a, summary')
            )
              return;
            if (row) open(row.id);
          }),
          x: shown(e => row && toggle(row.id, e.shiftKey)),
        }
      : {}
  );

  return (
    <div className="sa-table-wrap" ref={wrap}>
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
                aria-current={c.id === route.conversation || undefined}
                onClick={e => {
                  if (!(e.target as Element).closest('.sa-check')) open(c.id);
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
                <td className="num sa-col-wait">
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
                <td className="sa-col-main">
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
                          open(c.id);
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
                      <div className="sa-meta">
                        <span className="sa-fine">
                          {t(`agentType.${c.type}`)} · {inboxName(c.inbox)}
                        </span>
                        {c.viewers?.length ? (
                          <ViewerStack t={t} viewers={c.viewers} />
                        ) : null}
                        {c.tier && <span className="sa-pill">{c.tier}</span>}
                        {c.slaDueAt && c.status !== 'resolved' && (
                          <DueChip t={t} locale={locale} dueAt={c.slaDueAt} />
                        )}
                        {c.rating && (
                          <RatingChip
                            t={t}
                            rating={c.rating}
                            score={c.ratingScore}
                          />
                        )}
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
                      </div>
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
                  <td className="sa-col-pri">
                    {top.includes(c.priority) && (
                      <span
                        className="sa-pill"
                        data-tone={
                          c.priority === me.priorities.at(-1)
                            ? 'urgent'
                            : 'high'
                        }>
                        {priorityName(c.priority)}
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
