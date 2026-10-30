import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  type ToggleEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type { CustomFieldDef, HostLink, Locale } from '../config';
import {
  dateLocale,
  formatMinutes,
  type Translate,
  translated,
} from '../ui/i18n';

export const paths = {
  sparkle:
    'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 3v4M21 5h-4',
  plus: 'M12 5v14M5 12h14',
  filter: 'M4 6h16M7 12h10M10 18h4',
  back: 'M15 18l-6-6 6-6',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  text: 'M4 6h16M4 12h10M4 18h7',
  panel: 'M4 5h16v14H4zM15 5v14',
  external:
    'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  chevron: 'M6 9l6 6 6-6',
};

export function Svg({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const bone = (width: number | string, height?: number, round = false) => (
  <span
    className="sa-bone"
    style={{ width, height, borderRadius: round ? 999 : undefined }}
  />
);

export function Skeleton({
  kind,
  label,
  columns,
  summary = false,
  aside = true,
}: {
  kind: 'table' | 'thread' | 'cards';
  label: string;
  /** For a CRM list: one avatar-and-name column, then plain ones. Without it, the inbox's row. */
  columns?: number;
  /** The contact page's summary card under the page head. */
  summary?: boolean;
  /** The details column; off when the page will open without it, so the page does not move when it loads. */
  aside?: boolean;
}) {
  const rows = [0, 1, 2, 3, 4, 5];
  const status = (
    <span className="sa-sr-only" role="status">
      {label}
    </span>
  );
  if (kind === 'table') {
    return (
      <div className="sa-table-wrap sa-skeleton" aria-busy="true">
        {status}
        <table className="sa-table" aria-hidden="true">
          <thead>
            <tr>
              {rows.slice(0, columns ?? 4).map(c => (
                <th key={c}>{bone(64)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(i => (
              <tr key={i}>
                {columns ? (
                  <>
                    <td>
                      <span className="sa-who">
                        {bone(28, 28, true)}
                        {bone(`${[50, 38, 56, 44, 60, 34][i]}%`)}
                      </span>
                    </td>
                    {rows.slice(1, columns).map(c => (
                      <td key={c}>{bone(72)}</td>
                    ))}
                  </>
                ) : (
                  <>
                    <td>{bone(44, 22, true)}</td>
                    <td>
                      <div className="sa-cell">
                        {bone(26, 26)}
                        <div className="sa-cell-title">
                          <span>{bone(`${[62, 48, 70, 55, 66, 44][i]}%`)}</span>
                          <span className="sa-fine">{bone(120)}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="sa-who">
                        {bone(28, 28, true)}
                        {bone(96)}
                      </span>
                    </td>
                    <td>{bone(56, 22, true)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="sa sa-skeleton" aria-busy="true">
      {status}
      <div className="sa-page-head" aria-hidden="true">
        {bone(80, 32)}
        <h2>{bone('min(320px, 50vw)')}</h2>
      </div>
      {summary && (
        <div className="sa-card sa-summary" aria-hidden="true">
          {bone(44, 44, true)}
          <div className="sa-cell-title">
            <h2>{bone(180)}</h2>
            <span className="sa-muted">{bone(240)}</span>
          </div>
        </div>
      )}
      <div className="sa-split" aria-hidden="true">
        {kind === 'thread' ? (
          <div className="sa">
            <div className="sa-toolbar sa-fields sa-props">
              {rows.slice(1).map(i => (
                <span key={i}>{bone('100%', 36)}</span>
              ))}
            </div>
            <div className="sa-thread">
              {[60, 45, 70].map((width, i) => (
                <div
                  key={width}
                  className="sa-msg"
                  data-author={i === 1 ? 'agent' : 'contact'}>
                  {bone(28, 28, true)}
                  <div>
                    <header>{bone(140)}</header>
                    <div className="sa-msg-body" style={{ width: `${width}%` }}>
                      {bone('90%')}
                      <br />
                      {bone('60%')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <section className="sa-card">
            <h3>{bone(96)}</h3>
            {bone('100%', 160)}
          </section>
        )}
        <aside className="sa" hidden={!aside}>
          {[96, 140, 72].map(height => (
            <div key={height} className="sa-card">
              <h3>{bone(96)}</h3>
              {bone('100%', height)}
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

/** The copy's first sentence is the title, the rest says how to fill the screen. */
export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  const [, title = text, body] = /^(.+?[.…])\s+(.+)$/.exec(text) ?? [];
  return (
    <div className="sa-empty">
      <strong>{title}</strong>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

/** A refresh failed while something is on screen: it stays, and this floats over it until one succeeds. */
export function StaleNotice({ t }: { t: Translate }) {
  return (
    <div className="sa-stale" role="status">
      {t('load.stale')}
    </div>
  );
}

export function LoadError({
  t,
  onRetry,
}: {
  t: Translate;
  onRetry: () => void;
}) {
  return (
    <div className="sa-notice" role="alert">
      <span>{t('load.failed')}</span>
      <button type="button" className="sa-btn" onClick={onRetry}>
        {t('admin.retry')}
      </button>
    </div>
  );
}

export function initials(value: string | null | undefined) {
  const words = (value ?? '?').replace(/@.*/, '').split(/[\s._-]+/);
  return words
    .map(word => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({
  name,
  agent,
}: {
  name: string | null;
  agent?: boolean;
}) {
  return (
    <span className="sa-avatar" data-agent={agent} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export type Viewer = { id: string; name: string | null };

export function viewingLine(t: Translate, viewers: Viewer[]) {
  const name = (i: number) => viewers[i]?.name ?? '?';
  if (viewers.length === 1) return t('admin.viewing.one', { name: name(0) });
  if (viewers.length === 2)
    return t('admin.viewing.two', { name: name(0), other: name(1) });
  return t('admin.viewing.many', {
    name: name(0),
    count: String(viewers.length - 1),
  });
}

export function ViewerStack({
  t,
  viewers,
}: {
  t: Translate;
  viewers: Viewer[];
}) {
  const line = viewingLine(t, viewers);
  return (
    <span className="sa-viewers" role="img" aria-label={line} title={line}>
      {viewers.map(v => (
        <Avatar key={v.id} name={v.name} agent />
      ))}
    </span>
  );
}

/** A modal on the native `<dialog>`, so focus trapping and Escape come free. */
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sa-dialog"
      onClose={onClose}
      aria-label={title}>
      {open && children}
    </dialog>
  );
}

/**
 * Asks a yes-or-no question in the agent UI's own modal, never the browser's
 * `confirm()`. `ask` resolves true when the agent takes the action; render
 * `node` once wherever the hook is used.
 */
export function useConfirm(t: Translate) {
  const [request, setRequest] = useState<{
    message: string;
    action: string;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const finish = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };
  /** Without an `action`, the question is a permanent delete. */
  const ask = (
    message = t('admin.confirmDelete'),
    action = t('admin.delete')
  ) =>
    new Promise<boolean>(resolve => setRequest({ message, action, resolve }));
  const node = (
    <Dialog
      open={request !== null}
      title={request?.action ?? ''}
      onClose={() => finish(false)}>
      <div className="sa-dialog-body">
        <h2>{request?.action}</h2>
        <p className="sa-muted">{request?.message}</p>
        <div className="sa-dialog-foot">
          <button
            type="button"
            className="sa-btn"
            // biome-ignore lint/a11y/noAutofocus: the safe choice takes focus when the modal opens.
            autoFocus
            onClick={() => finish(false)}>
            {t('admin.cancel')}
          </button>
          <button
            type="button"
            className="sa-btn sa-destructive"
            onClick={() => finish(true)}>
            {request?.action}
          </button>
        </div>
      </div>
    </Dialog>
  );
  return { ask, node };
}

/** An agent's on/off preference, remembered in this browser. */
function storedSwitch(key: string, byDefault: boolean) {
  const changed = `${key}:changed`;
  // Stands in for localStorage where it throws, so the switch still works for this page.
  let fallback = byDefault;
  const read = () => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? byDefault : value === 'on';
    } catch {
      return fallback;
    }
  };
  const set = (on: boolean) => {
    fallback = on;
    try {
      if (on === byDefault) localStorage.removeItem(key);
      else localStorage.setItem(key, on ? 'on' : 'off');
    } catch {}
    window.dispatchEvent(new Event(changed));
  };
  const useSwitch = () =>
    useSyncExternalStore(
      change => {
        window.addEventListener(changed, change);
        return () => window.removeEventListener(changed, change);
      },
      read,
      () => byDefault
    );
  return { read, set, useSwitch };
}

const keys = storedSwitch('helpdesk.keys', true);
export const setKeysOn = keys.set;
/** Whether the agent left single-key shortcuts on (WCAG 2.1.4). */
export const useKeysOn = keys.useSwitch;

const queue = storedSwitch('helpdesk.queue', false);
export const setQueueOn = queue.set;
/** "Work the queue": after a reply, the next conversation in the inbox's order opens. */
export const useQueueOn = queue.useSwitch;

const titleCount = storedSwitch('helpdesk.titleCount', true);
export const setTitleCountOn = titleCount.set;
/** Whether new notifications are counted in the tab title; muted per browser. */
export const useTitleCountOn = titleCount.useSwitch;

/**
 * Single-key shortcuts on the window, keyed by `KeyboardEvent.key` with letters
 * in lower case.
 * Keys typed into a field, held with Cmd/Ctrl/Alt, or pressed in or behind an
 * open dialog are left alone, and none run while the agent has turned them off.
 */
export function useShortcuts(
  map: Record<string, ((e: KeyboardEvent) => void) | undefined>
) {
  const latest = useRef(map);
  useLayoutEffect(() => {
    latest.current = map;
  });
  // Bound before paint, so a key pressed as the page shows is not lost.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const run = latest.current[key];
      // The event is retargeted to the host element when the admin sits in a shadow root.
      const target = e.composedPath()[0];
      if (
        !run ||
        !keys.read() ||
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        !(target instanceof Element) ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"]'
        ) ||
        (target.getRootNode() as Document | ShadowRoot).querySelector(
          'dialog[open]'
        ) ||
        (key === 'Enter' && target.closest('button, a, [role="tab"]'))
      ) {
        return;
      }
      e.preventDefault();
      run(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function useToast() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => setText(null), 2000);
    return () => clearTimeout(timer);
  }, [text]);
  return {
    show: setText,
    // Mounted while empty: a live region that appears already filled may go unannounced.
    node: (
      <div className="sa-toast" role="status">
        {text}
      </div>
    ),
  };
}

/** "Chrome 153 · macOS" from a user agent string. */
export function browserLabel(userAgent: string) {
  const browser =
    /Edg\/(\d+)/.exec(userAgent)?.[1] !== undefined
      ? `Edge ${/Edg\/(\d+)/.exec(userAgent)?.[1]}`
      : /Firefox\/(\d+)/.exec(userAgent)
        ? `Firefox ${/Firefox\/(\d+)/.exec(userAgent)?.[1]}`
        : /Chrome\/(\d+)/.exec(userAgent)
          ? `Chrome ${/Chrome\/(\d+)/.exec(userAgent)?.[1]}`
          : /Version\/(\d+).*Safari/.exec(userAgent)
            ? `Safari ${/Version\/(\d+)/.exec(userAgent)?.[1]}`
            : null;
  const os = /iPhone|iPad/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return [browser, os].filter(Boolean).join(' · ') || userAgent;
}

export function humanizeKey(key: string) {
  const spaced = key
    .replace(/^utm_/i, 'UTM ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function money(value: string | null, currency: string, locale: string) {
  if (value === null) return '';
  return new Intl.NumberFormat(
    locale === 'de'
      ? 'de-CH'
      : locale === 'fr'
        ? 'fr-CH'
        : locale === 'it'
          ? 'it-CH'
          : 'en-CH',
    {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }
  ).format(Number(value));
}

type CustomValue = string | number | null;

export function CustomFields({
  fields,
  values,
  locale,
  onChange,
}: {
  fields: CustomFieldDef[];
  values: Record<string, CustomValue>;
  locale: Locale;
  onChange: (key: string, value: CustomValue) => void;
}) {
  return fields.map(field => {
    const value = values[field.key];
    return field.type === 'select' ? (
      <label key={field.key} className="sa-field">
        {translated(field.label, locale)}
        <select
          className="sa-select"
          style={{ width: '100%' }}
          value={String(value ?? '')}
          onChange={e => onChange(field.key, e.target.value || null)}>
          <option value="">—</option>
          {[
            ...(field.options ?? []),
            ...(value != null && !field.options?.includes(String(value))
              ? [String(value)]
              : []),
          ].map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    ) : (
      <label key={field.key} className="sa-field">
        {translated(field.label, locale)}
        <input
          className="sa-input"
          type={
            field.type === 'number'
              ? 'number'
              : field.type === 'date'
                ? 'date'
                : 'text'
          }
          value={String(value ?? '')}
          onChange={e =>
            onChange(
              field.key,
              e.target.value === ''
                ? null
                : field.type === 'number'
                  ? Number(e.target.value)
                  : e.target.value
            )
          }
        />
      </label>
    );
  });
}

/** A property of the open record, labelled above its control so it never reads as a filter. */
export function Property({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="sa-prop">
      <span className="sa-eyebrow" aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  );
}

export function Select({
  label,
  value,
  options,
  render,
  onChange,
  placeholder = false,
  disabled = false,
  labelled = false,
}: {
  label: string;
  value: string;
  options: string[];
  render: (value: string) => string;
  onChange: (value: string) => void;
  /** Adds an empty `''` option that shows the label alone; no option may then be `''`. */
  placeholder?: boolean;
  disabled?: boolean;
  /** A visible label already names the field, so the options leave it out. */
  labelled?: boolean;
}) {
  return (
    <select
      className="sa-select"
      aria-label={label}
      title={label}
      disabled={disabled}
      value={value}
      onChange={e => onChange(e.target.value)}>
      {placeholder && (
        <option value="" disabled>
          {label}
        </option>
      )}
      {options.map(o => (
        // The closed select shows only this text, so it names its field.
        <option key={o} value={o}>
          {labelled ? render(o) : `${label}: ${render(o)}`}
        </option>
      ))}
    </select>
  );
}

export function RatingChip({
  t,
  rating,
  score,
  comment,
}: {
  t: Translate;
  rating: 'good' | 'bad';
  /** On a five-point scale, the score itself. */
  score?: number | null;
  comment?: string | null;
}) {
  return (
    <span
      className="sa-pill sa-rating"
      data-rating={rating}
      title={comment ?? undefined}>
      {score
        ? t('admin.outOfFive', { score: String(score) })
        : t(`admin.rated.${rating}`)}
    </span>
  );
}

/** How long until a service-level deadline, or how far past it. */
export function DueChip({
  t,
  locale,
  dueAt,
}: {
  t: Translate;
  locale: Locale;
  dueAt: string;
}) {
  const ms = Date.parse(dueAt) - Date.now();
  const time = formatMinutes(Math.round(Math.abs(ms) / 60_000), locale);
  return (
    <span
      className="sa-pill sa-due"
      data-tone={ms < 0 ? 'late' : ms < 2 * 3_600_000 ? 'soon' : undefined}
      title={new Date(dueAt).toLocaleString(dateLocale(locale))}>
      {t(ms < 0 ? 'admin.overdue' : 'admin.dueIn', { time })}
    </span>
  );
}

/** The host's links for a customer, from its `links` hook; each opens in a new tab. */
export function HostLinks({
  links,
  locale,
}: {
  links: HostLink[] | undefined;
  locale: Locale;
}) {
  if (!links?.length) return null;
  return (
    <div className="sa-links">
      {links.map(link => (
        <a
          key={link.url}
          className="sa-btn sa-ghost"
          href={link.url}
          target="_blank"
          rel="noreferrer">
          {link.label[locale] ??
            link.label.en ??
            Object.values(link.label)[0] ??
            link.url}
          <Svg d={paths.external} />
        </a>
      ))}
    </div>
  );
}

/**
 * A menu in the top layer, so no scroll pane clips it. It is placed when it
 * opens: under its button, or above it, with their end edges aligned where
 * that fits in the viewport.
 */
export function Menu({
  label,
  button,
  className = 'sa-btn sa-ghost',
  popClass,
  above = false,
  onOpen,
  children,
}: {
  /** The button's accessible name. */
  label: string;
  /** What the button shows. */
  button: ReactNode;
  className?: string;
  popClass?: string;
  above?: boolean;
  onOpen?: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => pop.current?.hidePopover?.();
  const place = () => {
    const at = anchor.current?.getBoundingClientRect();
    const menu = pop.current;
    if (!at || !menu) return;
    const margin = 8;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left =
      at.right - width >= margin
        ? at.right - width
        : Math.min(at.left, window.innerWidth - width - margin);
    const top = above ? at.top - 4 - height : at.bottom + 4;
    menu.style.left = `${Math.max(margin, left)}px`;
    menu.style.top = `${Math.max(
      margin,
      Math.min(top, window.innerHeight - height - margin)
    )}px`;
  };
  // Fixed in the viewport, the menu would stay behind when its button scrolls away or the window resizes.
  useEffect(() => {
    if (!open) return;
    const hide = (e: Event) => {
      if (!pop.current?.contains(e.target as Node))
        pop.current?.hidePopover?.();
    };
    document.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open]);
  // Escape is the menu's: a pane around it would otherwise take it and move focus elsewhere.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.preventDefault();
    close();
    anchor.current?.focus();
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={className}
        aria-label={label}
        aria-expanded={open}
        popoverTarget={id}
        onKeyDown={onKeyDown}>
        {button}
      </button>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Escape bubbles up from the menu's own controls. */}
      <div
        id={id}
        ref={pop}
        popover="auto"
        className={`sa-menu-pop${popClass ? ` ${popClass}` : ''}`}
        onKeyDown={onKeyDown}
        // Toggle arrives a task after the menu shows; until it is placed it stays invisible, so it never paints in the corner.
        onBeforeToggle={(e: ToggleEvent<HTMLDivElement>) => {
          if (e.newState === 'open')
            e.currentTarget.style.visibility = 'hidden';
        }}
        onToggle={(e: ToggleEvent<HTMLDivElement>) => {
          const opened = e.newState === 'open';
          setOpen(opened);
          if (!opened) return;
          place();
          e.currentTarget.style.visibility = '';
          onOpen?.();
        }}>
        {children(close)}
      </div>
    </>
  );
}

/** Whether the element is narrower than `below`; false until it has a layout. */
export function useNarrow(ref: RefObject<HTMLElement | null>, below: number) {
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () =>
      setNarrow(el.clientWidth > 0 && el.clientWidth < below);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, below]);
  return narrow;
}
