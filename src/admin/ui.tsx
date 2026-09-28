import { type ReactNode, useEffect, useRef, useState } from 'react';

export const paths = {
  sparkle:
    'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 3v4M21 5h-4',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 18l-6-6 6-6',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  text: 'M4 6h16M4 12h10M4 18h7',
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

export function Loading({ label }: { label: string }) {
  return (
    <p className="sa-empty" aria-busy="true">
      {label}
    </p>
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

export function useToast() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => setText(null), 2000);
    return () => clearTimeout(timer);
  }, [text]);
  return {
    show: setText,
    node: text ? (
      <div className="sa-toast" role="status">
        {text}
      </div>
    ) : null,
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
