'use client';

import { useEffect, useState } from 'react';
import {
  PiAtBold,
  PiBellRingingBold,
  PiChatTextBold,
  PiUserCircleBold,
} from 'react-icons/pi';

type Mini = [string, string, string, number, string, '' | 'warn' | 'late'];
const INBOXES: Record<'support' | 'sales', Mini[]> = {
  support: [
    ['KM', 'ACME-1036', 'Rechnung als PDF auf Deutsch?', 95, 'de', 'late'],
    [
      'TB',
      'ACME-1041',
      'Export to CSV times out on large ranges',
      190,
      'bug',
      '',
    ],
    ['MO', 'ACME-1042', 'Invoice shows the old VAT number', 24, 'billing', ''],
  ],
  sales: [
    ['AR', 'ACME-1039', 'Can we get SSO on the Team plan?', 340, 'sso', 'warn'],
    ['EK', 'ACME-1044', 'Volume pricing for 40 agents', 260, 'pricing', ''],
  ],
};
const WAIT: Record<string, number> = {
  'ACME-1036': 26 * 60,
  'ACME-1041': 72,
  'ACME-1042': 4,
  'ACME-1039': 7 * 60,
  'ACME-1044': 18,
};
const EVENTS: [typeof PiBellRingingBold, string][] = [
  [PiBellRingingBold, 'Reminder sent to Jonas · ACME-1036 has waited 26 hours'],
  [PiChatTextBold, 'Canned reply “Corrected invoice” used on ACME-1042'],
  [PiAtBold, 'Jonas mentioned Lea on ACME-1039'],
  [PiUserCircleBold, 'ACME-1041 assigned to Ana with the a key'],
];

const fmt = (m: number) =>
  m < 60
    ? `${m}m`
    : m % 60 && m < 600
      ? `${Math.floor(m / 60)}h ${m % 60}m`
      : `${Math.floor(m / 60)}h`;

/** The bento's inbox: two inboxes to switch between, waits that keep counting, and what the team did last. */
export function MiniInbox() {
  const [inbox, setInbox] = useState<'support' | 'sales'>('support');
  const [extra, setExtra] = useState(0);
  const [event, setEvent] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tick = setInterval(() => setExtra(m => m + 1), 6000);
    const feed = setInterval(
      () => setEvent(e => (e + 1) % EVENTS.length),
      3200
    );
    return () => {
      clearInterval(tick);
      clearInterval(feed);
    };
  }, []);
  const [Icon, text] = EVENTS[event] ?? EVENTS[0] ?? [PiBellRingingBold, ''];
  return (
    <div className="mini-box">
      <fieldset className="mini-tabs">
        <legend className="vh">Inbox</legend>
        {(['support', 'sales'] as const).map(id => (
          <button
            key={id}
            type="button"
            aria-pressed={inbox === id}
            onClick={() => setInbox(id)}>
            {id === 'support' ? 'Support' : 'Sales'}{' '}
            <span>{INBOXES[id].length}</span>
          </button>
        ))}
      </fieldset>
      <ul className="mini" key={inbox}>
        {INBOXES[inbox].map(([ini, ref, subject, hue, tag, level], i) => (
          <li key={ref} style={{ animationDelay: `${i * 60}ms` }}>
            <span className="av" style={{ '--h': hue } as React.CSSProperties}>
              {ini}
            </span>
            <span className="m-s">
              {ref} · {subject}
            </span>
            <span className="pr">{tag}</span>
            <span className={`a-wait ${level}`}>
              {fmt((WAIT[ref] ?? 0) + extra)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mini-feed" aria-live="polite">
        <Icon aria-hidden="true" />
        <span key={event}>{text}</span>
      </p>
    </div>
  );
}
