'use client';

import { useEffect, useState } from 'react';

import { ButtonIcon } from './icons';
import { openWidget } from './launcher-skin';
import { Face } from './mark';

/** Beside the questions: the face brightens while an answer is open. */
export function FaqAside() {
  const [open, setOpen] = useState(0);
  useEffect(() => {
    const items = [
      ...document.querySelectorAll<HTMLDetailsElement>('#faq details'),
    ];
    const count = () => setOpen(items.filter(d => d.open).length);
    for (const d of items) d.addEventListener('toggle', count);
    return () => {
      for (const d of items) d.removeEventListener('toggle', count);
    };
  }, []);
  return (
    <aside className="faq-aside" aria-labelledby="faq-ask">
      <span className="mk mk-72">
        <Face mood={open ? 'smile' : 'flat'} fg="var(--bg)" bg="var(--mint)" />
      </span>
      <h3 id="faq-ask">Still a question?</h3>
      <p>We read every message and usually reply within two working days.</p>
      <button className="btn btn-p btn-sm" type="button" onClick={openWidget}>
        Ask now
        <ButtonIcon />
      </button>
    </aside>
  );
}
