'use client';

import { useEffect, useState } from 'react';

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
