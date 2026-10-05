'use client';

import { useEffect, useState } from 'react';

// Eyes are two cells tall; closed, only the lower cell stays lit.
const LEFT_OPEN = 'M1.5 .5h1v2h-1z';
const RIGHT_OPEN = 'M3.5 .5h1v2h-1z';
const LEFT_SHUT = 'M1.5 1.5h1v1h-1z';
const RIGHT_SHUT = 'M3.5 1.5h1v1h-1z';
const SMILE = 'M.5 3.5h1v1h-1zM4.5 3.5h1v1h-1zM1.5 4.5h3v1h-3z';

export type Eyes = 'open' | 'shut' | 'wink';

export function MarkFrame({
  fg,
  bg,
  eyes = 'open',
}: {
  fg: string;
  bg: string;
  eyes?: Eyes;
}) {
  const left = eyes === 'shut' ? LEFT_SHUT : LEFT_OPEN;
  const right = eyes === 'open' ? RIGHT_OPEN : RIGHT_SHUT;
  return (
    <svg viewBox="0 0 6 6" shapeRendering="crispEdges" aria-hidden="true">
      <rect width="6" height="6" fill={bg} />
      <path d={left + right + SMILE} fill={fg} />
    </svg>
  );
}

const reduced = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The logo's one animation: it blinks, at an uneven pace so a row of marks
 * never blinks in step. Sometimes twice. `wink` holds one eye shut, for hover.
 */
export function LiveMark({
  fg,
  bg,
  wink = false,
}: {
  fg: string;
  bg: string;
  wink?: boolean;
}) {
  const [shut, setShut] = useState(false);
  useEffect(() => {
    if (reduced()) return;
    let timer: ReturnType<typeof setTimeout>;
    const blink = (twice: boolean) => {
      setShut(true);
      timer = setTimeout(() => {
        setShut(false);
        timer = twice
          ? setTimeout(() => blink(false), 160)
          : setTimeout(schedule, 0);
      }, 120);
    };
    const schedule = () => {
      timer = setTimeout(
        () => blink(Math.random() < 0.25),
        4000 + Math.random() * 3000
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return (
    <MarkFrame fg={fg} bg={bg} eyes={shut ? 'shut' : wink ? 'wink' : 'open'} />
  );
}
