import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type { Translate } from '../ui/i18n';

export const paths = {
  sparkle:
    'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 3v4M21 5h-4',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 18l-6-6 6-6',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  text: 'M4 6h16M4 12h10M4 18h7',
  panel: 'M4 5h16v14H4zM15 5v14',
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
}: {
  kind: 'table' | 'thread' | 'cards';
  label: string;
  /** For a CRM list: one avatar-and-name column, then plain ones. Without it, the inbox's row. */
  columns?: number;
  /** The contact page's summary card under the page head. */
  summary?: boolean;
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
            <div className="sa-toolbar sa-fields">
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
        <aside className="sa">
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

const KEYS_KEY = 'helpdesk.keys';
const KEYS_CHANGED = 'helpdesk:keys';
// Stands in for localStorage where it throws, so the switch still works for this page.
let keysOff = false;

function keysOn() {
  try {
    return localStorage.getItem(KEYS_KEY) !== 'off';
  } catch {
    return !keysOff;
  }
}

export function setKeysOn(on: boolean) {
  keysOff = !on;
  try {
    if (on) localStorage.removeItem(KEYS_KEY);
    else localStorage.setItem(KEYS_KEY, 'off');
  } catch {}
  window.dispatchEvent(new Event(KEYS_CHANGED));
}

/** Whether the agent left single-key shortcuts on (WCAG 2.1.4); remembered in this browser. */
export function useKeysOn() {
  return useSyncExternalStore(
    change => {
      window.addEventListener(KEYS_CHANGED, change);
      return () => window.removeEventListener(KEYS_CHANGED, change);
    },
    keysOn,
    () => true
  );
}

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
        !keysOn() ||
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
  return new Intl.NumberFormat(locale === 'de' ? 'de-CH' : 'en-CH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function Select({
  label,
  value,
  options,
  render,
  onChange,
  placeholder = false,
  disabled = false,
}: {
  label: string;
  value: string;
  options: string[];
  render: (value: string) => string;
  onChange: (value: string) => void;
  /** Adds an empty `''` option that shows the label alone; no option may then be `''`. */
  placeholder?: boolean;
  disabled?: boolean;
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
          {label}: {render(o)}
        </option>
      ))}
    </select>
  );
}

export function RatingChip({
  t,
  rating,
  comment,
}: {
  t: Translate;
  rating: 'good' | 'bad';
  comment?: string | null;
}) {
  return (
    <span
      className="sa-pill sa-rating"
      data-rating={rating}
      title={comment ?? undefined}>
      {t(`admin.rated.${rating}`)}
    </span>
  );
}
