'use client';

import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import { PiCheckBold, PiCopyBold } from 'react-icons/pi';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(timer);
  }, [done]);
  return (
    <button
      className="cp"
      type="button"
      aria-label={done ? 'Copied' : label}
      data-state={done ? 'ok' : undefined}
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => {
            setDone(true);
            posthog.capture('install_copied');
          },
          () => setDone(false)
        );
      }}>
      {done ? (
        <PiCheckBold aria-hidden="true" />
      ) : (
        <PiCopyBold aria-hidden="true" />
      )}
    </button>
  );
}

const INSTALL = 'npm install better-helpdesk pg';

export function Install() {
  return (
    <span className="inst">
      <span className="pr">$</span>
      <b>{INSTALL}</b>
      <CopyButton text={INSTALL} label="Copy install command" />
    </span>
  );
}
