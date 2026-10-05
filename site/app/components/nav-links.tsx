'use client';

import { useEffect, useRef, useState } from 'react';
import { PiListBold } from 'react-icons/pi';

const LINKS: [string, string][] = [
  ['product', 'Product'],
  ['pieces', 'How it works'],
  ['widget', 'Customers'],
  ['cost', 'Compare'],
  ['faq', 'FAQ'],
];

/** Marks the link of whichever section holds the middle of the viewport. */
export function NavLinks({ base = '' }: { base?: string }) {
  const [here, setHere] = useState('');
  useEffect(() => {
    const sections = LINKS.map(([id]) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null
    );
    // Nothing is marked while the middle of the viewport is outside every
    // linked section, as over the hero.
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        setHere(LINKS.find(([id]) => visible.has(id))?.[0] ?? '');
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    for (const el of sections) io.observe(el);
    return () => io.disconnect();
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
          <a href={repo} onClick={close}>
            Source
          </a>
          <a className="btn btn-p" href="/quickstart/" onClick={close}>
            Quickstart
          </a>
        </nav>
      </div>
    </>
  );
}
