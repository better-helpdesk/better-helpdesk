'use client';

import { useEffect, useRef, useState } from 'react';

import { FILES } from '../../../lib/content';
import { highlight } from './highlight';

const STEPS = [
  'A developer writes in the widget on your page.',
  'The widget posts to your route handler.',
  'The message lands in a helpdesk conversation.',
  'Your team answers in a route you protect.',
];
const LAYERS: [string, string, string][] = [
  ['widget', '<HelpdeskWidget />', 'widget/*'],
  ['handler', 'route.ts', 'inbound · jobs'],
  ['db', 'helpdesk', 'schema in your Postgres'],
  ['admin', '<HelpdeskAdmin />', 'agent/*'],
];
const STEP_MS = 1400;

/** One message's path through the four pieces, played once when it scrolls in. */
export function Pieces() {
  const [step, setStep] = useState(-1);
  const [run, setRun] = useState(0);
  const stack = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const el = stack.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setRun(1);
          io.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!run) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(STEPS.length - 1);
      return;
    }
    timers.current = STEPS.map((_, i) =>
      setTimeout(() => setStep(i), 300 + i * STEP_MS)
    );
    return () => timers.current.forEach(clearTimeout);
  }, [run]);

  // A file tab and a step are the same moment: choosing one shows the other.
  const show = (i: number) => {
    timers.current.forEach(clearTimeout);
    setStep(i);
  };
  const shown = Math.max(step, 0);
  const current = FILES[shown] ?? FILES[0];
  const at = STEPS[step];

  return (
    <div className="pc">
      <div className="stack" ref={stack}>
        <div className="host-label">your Next.js app</div>
        <ol
          className="path"
          aria-label="How a message moves through the four pieces">
          {LAYERS.map(([id, name, routes], i) => (
            <li
              key={id}
              className={`layer l-${id}${step >= i ? ' lit' : ''}${step === i ? ' now' : ''}`}>
              {i > 0 && (
                <span className="wire" aria-hidden="true">
                  {[0, 1, 2].map(c => (
                    <i key={c} style={{ transitionDelay: `${c * 90}ms` }} />
                  ))}
                </span>
              )}
              <b>{name}</b>
              <span>{routes}</span>
            </li>
          ))}
        </ol>
        <div className="path-cap" aria-live="polite">
          <span className="path-n">
            {at ? `${step + 1} / ${STEPS.length}` : '· / 4'}
          </span>
          <span>{at ?? 'One message, start to finish.'}</span>
          <button
            type="button"
            className="replay"
            onClick={() => {
              setStep(-1);
              setRun(r => r + 1);
            }}>
            Replay
          </button>
        </div>
      </div>
      <div className="code">
        <div className="code-tabs" role="tablist" aria-label="Files">
          {FILES.map(([name], i) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={shown === i}
              onClick={() => show(i)}>
              {name}
            </button>
          ))}
        </div>
        <pre>
          <code>{current ? highlight(current[1]) : null}</code>
        </pre>
        <div className="code-foot">
          <span>One route handler</span>
          <span>One component</span>
          <span>One widget</span>
        </div>
      </div>
    </div>
  );
}
