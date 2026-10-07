'use client';

import { useEffect, useState } from 'react';

import { openWidget } from '../components/launcher-skin';
import { shatter } from './glass';

/** Minutes until the next quarter hour, when instrumentation.ts resets the demo. */
export function ResetCountdown({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const period = minutes * 60_000;
    const tick = () =>
      setLeft(Math.ceil((period - (Date.now() % period)) / 60_000));
    tick();
    const timer = setInterval(tick, 10_000);
    return () => clearInterval(timer);
  }, [minutes]);
  if (left === null) return <>every {minutes} minutes</>;
  return <>in {left === 1 ? 'under a minute' : `${left} minutes`}</>;
}

let pressedUntil = 0;

function openBugReport() {
  const widget = document.querySelector<
    HTMLElement & { open?: (options: { type: string }) => void }
  >('helpdesk-widget');
  // Published releases before open() still open on the type list.
  if (widget?.open) widget.open({ type: 'bug' });
  else openWidget();
}

/**
 * Throws on purpose: the widget records the error, and opens on a bug report
 * that offers it. The page's ground cracks first, behind the content.
 */
export function BrokenButton() {
  return (
    <button
      type="button"
      className="btn btn-sm demo-quiet"
      onClick={event => {
        const now = performance.now();
        // A repeat press while the glass is up adds no layer and no duplicate error.
        if (now < pressedUntil) return;
        pressedUntil = now + 2000;
        const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!calm) {
          const button = event.currentTarget;
          const box = button.getBoundingClientRect();
          // detail is 0 for Enter and Space: crack from the button's centre.
          shatter(
            event.detail ? event.clientX : box.left + box.width / 2,
            event.detail ? event.clientY : box.top + box.height / 2
          );
          button.animate(
            [
              { transform: 'translateX(2px)', easing: 'steps(1)' },
              { transform: 'translateX(-2px)', easing: 'steps(1)' },
              { transform: 'none' },
            ],
            { duration: 120 }
          );
        }
        setTimeout(openBugReport, calm ? 0 : 480);
        throw new TypeError(
          "Cannot read properties of undefined (reading 'eta')"
        );
      }}>
      Press the broken button
    </button>
  );
}
