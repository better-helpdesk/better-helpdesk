'use client';

import { useEffect, useState } from 'react';

import { LiveMark } from './live-mark';

/**
 * Puts the mark over the package widget's launcher. The package only themes
 * its launcher through colours, so this paints a transparent chip inside the
 * open shadow root and lays the blinking mark on top with pointer events off:
 * clicks, focus and labels stay with the real button. Remove once the widget
 * accepts a launcher icon of its own.
 */
const SKIN = `.launcher{background:transparent;box-shadow:none;border-radius:0}.launcher>svg{opacity:0}`;

function launcher(): HTMLButtonElement | null {
  const host = document.querySelector('helpdesk-widget');
  return (
    host?.shadowRoot?.querySelector<HTMLButtonElement>('.launcher') ?? null
  );
}

/** Opens the real widget, for buttons elsewhere on the page. */
export function openWidget() {
  const button = launcher();
  if (button && button.getAttribute('aria-expanded') !== 'true') button.click();
}

export function LauncherSkin() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let observer: MutationObserver | undefined;
    const host = () => document.querySelector('helpdesk-widget');
    const attach = () => {
      const button = launcher();
      const root = host()?.shadowRoot;
      if (!button || !root) return false;
      if (!root.querySelector('style[data-site-skin]')) {
        const style = document.createElement('style');
        style.dataset.siteSkin = '';
        style.textContent = SKIN;
        root.append(style);
      }
      const sync = () =>
        setOpen(button.getAttribute('aria-expanded') === 'true');
      observer = new MutationObserver(sync);
      observer.observe(button, {
        attributes: true,
        attributeFilter: ['aria-expanded'],
      });
      button.addEventListener('pointerenter', () => setHover(true));
      button.addEventListener('pointerleave', () => setHover(false));
      sync();
      setReady(true);
      return true;
    };
    if (attach()) return () => observer?.disconnect();
    const poll = setInterval(() => {
      if (attach()) clearInterval(poll);
    }, 100);
    return () => {
      clearInterval(poll);
      observer?.disconnect();
    };
  }, []);

  if (!ready) return null;
  return (
    <span className={open ? 'skin open' : 'skin'} aria-hidden="true">
      <LiveMark fg="var(--bg)" bg="var(--mint)" wink={hover && !open} />
    </span>
  );
}
