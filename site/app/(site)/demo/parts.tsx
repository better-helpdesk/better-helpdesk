'use client';

import { useEffect, useState } from 'react';

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

/** Throws on purpose: the widget records the error and offers it with the next bug report. */
export function BrokenButton() {
  return (
    <button
      type="button"
      className="btn btn-sm demo-quiet"
      onClick={() => {
        throw new TypeError(
          "Cannot read properties of undefined (reading 'eta')"
        );
      }}>
      Press the broken button
    </button>
  );
}
