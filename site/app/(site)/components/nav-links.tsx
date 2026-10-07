'use client';

import { useEffect, useRef, useState } from 'react';
import { PiListBold } from 'react-icons/pi';

const LINKS: [string, string][] = [
  ['product', 'Product'],
  ['pieces', 'How it works'],
  ['widget', 'Customers'],
  ['box', 'Features'],
  ['compare', 'Compare'],
  ['faq', 'FAQ'],
];

/**
 * Marks the link of the last section that starts above the middle of the
 * viewport, so the unlinked sections in between keep the link before them.
 */
export function NavLinks({ base = '' }: { base?: string }) {
  const [here, setHere] = useState('');
  useEffect(() => {
    const sections = LINKS.map(([id]) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null
    );
    const last = sections.at(-1);
    const update = () => {
      const mid = window.innerHeight / 2;
      // Nothing is marked over the hero or past the last linked section.
      if (!last || last.getBoundingClientRect().bottom < mid)
        return setHere('');
      setHere(
        sections.filter(el => el.getBoundingClientRect().top <= mid).at(-1)
          ?.id ?? ''
      );
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return (
    <nav className="nav-links" aria-label="Main">
      {LINKS.map(([id, label]) => (
        <a
          key={id}
          href={`${base}#${id}`}
          aria-current={here === id ? 'true' : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}

/** The section links on phones, in a popover so the nav's clip-path cannot cut it off. */
export function NavMenu({ base = '', repo }: { base?: string; repo: string }) {
  const menu = useRef<HTMLDivElement>(null);
  const close = () => menu.current?.hidePopover();
  return (
    <>
      <button className="nav-menu-btn" type="button" popoverTarget="nav-menu">
        <PiListBold aria-hidden="true" />
        Menu
      </button>
      <div className="nav-menu" id="nav-menu" popover="auto" ref={menu}>
        <nav aria-label="Menu">
          {LINKS.map(([id, label]) => (
            <a key={id} href={`${base}#${id}`} onClick={close}>
              {label}
            </a>
          ))}
          <a href="/docs/" onClick={close}>
            Docs
          </a>
          <a href={repo} onClick={close}>
            Source
          </a>
          <a className="btn btn-p" href="/docs/installation/" onClick={close}>
            Get started
          </a>
        </nav>
      </div>
    </>
  );
}
