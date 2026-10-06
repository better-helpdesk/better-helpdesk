'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ARRIVING, BOARD, initials, ROWS, usd } from '../../../lib/content';
import { dither, reduced } from './dither';
import { Face, Mark } from './mark';

type Pane = 'inbox' | 'conv' | 'crm' | 'deals';
const PANES: [Pane, string][] = [
  ['inbox', 'Inbox'],
  ['conv', 'Conversation'],
  ['crm', 'Contacts'],
  ['deals', 'Deals'],
];
const CAPTIONS: Record<Pane, string> = {
  inbox:
    'Every conversation in one queue, with a reference like ACME-1042, a priority and a reminder email before anyone waits too long. Try j and k.',
  conv: 'See the page, the browser size and the last error before you ask “what were you looking at?” Email replies land in the same thread, checked against DKIM.',
  crm: 'Every customer gets a face: a real user from your login, with their company, deals and history.',
  deals:
    'Leads and deals move through stages you define, with how long each one has sat in its stage.',
};
const DRAFT =
  'Hi Mira, here is the corrected September invoice with your current VAT number. I’ve added finance@northwind.test as a billing contact.';
export function Showcase() {
  const [pane, setPane] = useState<Pane>('inbox');
  const [resolved, setResolved] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [live, setLive] = useState(false);
  const [minutes, setMinutes] = useState(4);
  const [arrived, setArrived] = useState(false);
  const [mailed, setMailed] = useState(false);
  const [pressed, setPressed] = useState('');
  const busy = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const go = useCallback(
    async (next: Pane) => {
      const cv = canvas.current;
      const host = frame.current;
      if (next === pane || busy.current || !cv || !host) return;
      busy.current = true;
      await dither(cv, host, true, 160);
      setPane(next);
      await dither(cv, host, false, 200);
      busy.current = false;
    },
    [pane]
  );

  // The product resolves out of the dither the first time it scrolls in.
  useEffect(() => {
    const el = frame.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    if (reduced()) {
      setLive(true);
      return;
    }
    const ctx = cv.getContext('2d');
    if (ctx) {
      cv.width = 1;
      cv.height = 1;
      ctx.fillStyle = getComputedStyle(el).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
    }
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          dither(cv, el, false, 520);
          setLive(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Once in view the queue keeps moving: Mira's wait ticks up, the reminder
  // email goes out, and a new conversation arrives at the end of the queue.
  useEffect(() => {
    if (!live) return;
    if (reduced()) {
      setMailed(true);
      setArrived(true);
      return;
    }
    const mail = setTimeout(() => setMailed(true), 1400);
    const arrive = setTimeout(() => setArrived(true), 3200);
    const tick = setInterval(() => setMinutes(m => Math.min(m + 1, 59)), 6000);
    return () => {
      clearTimeout(mail);
      clearTimeout(arrive);
      clearInterval(tick);
    };
  }, [live]);

  const rows = [...ROWS, ...(arrived ? [ARRIVING] : [])]
    .filter(r => !(resolved && r.active))
    .map(r => (r.active ? { ...r, waiting: `${minutes}m` } : r));

  // j and k move through the demo inbox, like the real one.
  useEffect(() => {
    if (pane !== 'inbox') return;
    const onKey = (e: KeyboardEvent) => {
      const el = frame.current;
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (!el || ['input', 'textarea', 'select'].includes(tag)) return;
      const box = el.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) return;
      if (e.key === 'j' || e.key === 'k' || e.key === 'Enter') {
        setPressed(e.key);
        setTimeout(() => setPressed(''), 160);
      }
      if (e.key === 'j' || e.key === 'k') {
        setCursor(c => {
          const from = c === -1 ? rows.length - 1 : c;
          return Math.max(
            0,
            Math.min(rows.length - 1, from + (e.key === 'j' ? 1 : -1))
          );
        });
      }
      if (e.key === 'Enter' && cursor !== -1) go('conv');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [pane, rows.length, cursor, go]);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n =
      (i + (e.key === 'ArrowRight' ? 1 : -1) + PANES.length) % PANES.length;
    const target = PANES[n];
    if (!target) return;
    go(target[0]);
    tabs.current[n]?.focus();
  };

  return (
    <>
      <div className="sc-top">
        <div className="sc-tabs" role="tablist" aria-label="Product views">
          {PANES.map(([id, label], i) => (
            <button
              key={id}
              ref={el => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-controls="sc-pane"
              aria-selected={pane === id}
              tabIndex={pane === id ? 0 : -1}
              onClick={() => go(id)}
              onKeyDown={e => onTabKey(e, i)}>
              {label}
            </button>
          ))}
        </div>
        <div className="mood">
          <span>
            {resolved
              ? 'Mira has her answer'
              : `${rows.length} conversations waiting`}
          </span>
          <span className="mk mk-48">
            <Face
              mood={resolved ? 'smile' : 'flat'}
              fg="var(--bg)"
              bg="var(--mint)"
            />
          </span>
        </div>
      </div>
      <div className="tray">
        <div className={resolved ? 'app tried' : 'app'} ref={frame}>
          <div className="dither" aria-hidden="true">
            <canvas ref={canvas} />
          </div>
          <nav className="a-side" aria-label="Sections">
            <div className="a-team">
              <span className="a-teammark">
                <Mark fg="var(--fg)" bg="var(--bg)" />
              </span>
              <b>Harbor</b>
            </div>
            <button
              type="button"
              className={pane === 'inbox' || pane === 'conv' ? 'on' : ''}
              onClick={() => go('inbox')}>
              Inbox <span>{rows.length}</span>
            </button>
            <button
              type="button"
              className={pane === 'crm' ? 'on' : ''}
              onClick={() => go('crm')}>
              Contacts
            </button>
            <button type="button" onClick={() => go('crm')}>
              Companies
            </button>
            <button
              type="button"
              className={pane === 'deals' ? 'on' : ''}
              onClick={() => go('deals')}>
              Deals
            </button>
            <span className="a-off">Canned replies</span>
            <span className="a-off">Settings</span>
          </nav>
          <div
            className="panes"
            id="sc-pane"
            role="tabpanel"
            aria-labelledby={`tab-${pane}`}>
            {pane === 'inbox' && (
              <Inbox
                rows={rows}
                cursor={cursor}
                mailed={mailed}
                pressed={pressed}
                open={() => go('conv')}
              />
            )}
            {pane === 'conv' && (
              <Conversation
                resolved={resolved}
                toggle={() => setResolved(r => !r)}
              />
            )}
            {pane === 'crm' && <Contacts />}
            {pane === 'deals' && <Deals />}
          </div>
        </div>
      </div>
      <div className="sc-cap">
        <p>{CAPTIONS[pane]}</p>
        <p className="sc-note">
          Recreated from <code>&lt;HelpdeskAdmin /&gt;</code> with its real
          labels and demo data, themed through <code>--helpdesk-*</code> custom
          properties.
        </p>
      </div>
    </>
  );
}

function Inbox({
  rows,
  cursor,
  mailed,
  pressed,
  open,
}: {
  rows: typeof ROWS;
  cursor: number;
  mailed: boolean;
  pressed: string;
  open: () => void;
}) {
  const selected = cursor === -1 ? rows.findIndex(r => r.active) : cursor;
  return (
    <div>
      <div className="a-bar">
        <div className="a-filters">
          <span className="a-chip on">All inboxes</span>
          <span className="a-chip">Assigned to me</span>
          <span className="a-chip">Unassigned</span>
          <span className="a-chip hot">High &amp; urgent · 2</span>
        </div>
        <span className="a-sort">Sort: Longest waiting</span>
      </div>
      <div className="a-thead">
        <span>Conversation</span>
        <span>Waiting</span>
      </div>
      <ul className="a-rows">
        {selected !== -1 && (
          <li
            className="a-sel"
            aria-hidden="true"
            style={{ transform: `translateY(${selected * 64}px)` }}
          />
        )}
        {rows.map((r, i) => {
          const on = selected === i;
          return (
            <li key={r.ref} className={r.fresh ? 'fresh' : undefined}>
              <button
                type="button"
                className={on ? 'a-row on' : 'a-row'}
                aria-current={on ? 'true' : undefined}
                onClick={open}>
                <span
                  className="av"
                  style={{ '--h': r.hue } as React.CSSProperties}>
                  {initials(r.who)}
                </span>
                <span className="a-t">
                  <b>{r.subject}</b>
                  <small>
                    {r.ref} · {r.who} · {r.company} · {r.inbox}
                  </small>
                </span>
                <span className="a-tags">
                  {mailed && r.level === 'late' && (
                    <span className="pr pr-sent">reminded</span>
                  )}
                  <span className={`pr pr-${r.priority}`}>{r.priority}</span>
                </span>
                <span className={`a-wait ${r.level}`}>{r.waiting}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="a-hint">
        <kbd className={pressed === 'j' ? 'on' : undefined}>j</kbd>
        <kbd className={pressed === 'k' ? 'on' : undefined}>k</kbd> move ·{' '}
        <kbd className={pressed === 'Enter' ? 'on' : undefined}>↵</kbd> open
      </div>
      <div className={mailed ? 'mail in' : 'mail'}>
        <div className="mail-h">
          <span>agent-reminder</span>
          <span>to jonas@harbor.test</span>
        </div>
        <b>ACME-1036 has waited 26 hours</b>
        <p>Kofi Mensah · Rechnung als PDF auf Deutsch?</p>
      </div>
    </div>
  );
}

const hue = (h: number) => ({ '--h': h }) as React.CSSProperties;

function Conversation({
  resolved,
  toggle,
}: {
  resolved: boolean;
  toggle: () => void;
}) {
  return (
    <div className="cv">
      <div className="cv-main">
        <div className="cv-h">
          <div>
            <b>Invoice shows the old VAT number</b>
            <small>ACME-1042 · support · Question</small>
          </div>
          <span className={resolved ? 'st st-ok' : 'st st-wait'}>
            {resolved ? 'Resolved' : 'Waiting 4m'}
          </span>
        </div>
        <div className="msgs">
          <div className="m">
            <div className="m-who">
              <span className="av" style={hue(24)}>
                MO
              </span>
              Mira Okafor <small>widget · /billing · 11:02</small>
            </div>
            <p>
              The invoice for September shows the old VAT number. Can you send a
              corrected one?
            </p>
          </div>
          <div className="m note">
            <div className="m-who">
              <span className="av" style={hue(210)}>
                JW
              </span>
              Jonas Weber <small>internal note</small>
            </div>
            <p>
              Billing profile changed on 12 September. Regenerate from there.
            </p>
            <small className="hint">Only your team sees internal notes.</small>
          </div>
          <div className="m">
            <div className="m-who">
              <span className="av" style={hue(24)}>
                MO
              </span>
              Mira Okafor <small>email · DKIM verified · threaded</small>
            </div>
            <p>Also, could the copy go to finance@northwind.test?</p>
          </div>
        </div>
        <div className="composer">
          <div className="cp-tabs">
            <span className="on">Reply</span>
            <span>Internal note</span>
            <span className="cp-ai">Suggested</span>
          </div>
          <div className="cp-text">
            {resolved
              ? 'Sent. Mira gets the reply in the widget and by email.'
              : DRAFT}
          </div>
          <div className="cp-foot">
            <span className="cp-keys">
              Type / for canned replies · ⌘⇧↵ send and resolve
            </span>
            <span className="cp-btns">
              <button type="button" className="a-btn">
                Send
              </button>
              <button
                type="button"
                className="a-btn a-btn-p"
                id="send-resolve"
                onClick={toggle}>
                {resolved ? 'Reopen' : 'Send and resolve'}
              </button>
            </span>
          </div>
        </div>
      </div>
      <aside className="cv-side">
        <div className="cs">
          <h4>Contact</h4>
          <p>
            <b>Mira Okafor</b>
            <br />
            mira@northwind.test <span className="ok">Verified</span>
          </p>
        </div>
        <div className="cs">
          <h4>Company</h4>
          <p>
            <b>Northwind</b> · customer
            <br />
            plan: team · seats: 14
          </p>
        </div>
        <div className="cs">
          <h4>Sent with the message</h4>
          <dl>
            <dt>Page</dt>
            <dd>/billing</dd>
            <dt>Window size</dt>
            <dd>1440 × 900</dd>
            <dt>Browser</dt>
            <dd>Chrome 141</dd>
            <dt>Recent errors</dt>
            <dd className="err">TypeError: vatId is undefined</dd>
          </dl>
        </div>
        <div className="cs">
          <h4>Deal</h4>
          <p>
            Northwind · Team annual
            <br />
            <b>$4,800</b> · proposal
          </p>
        </div>
      </aside>
    </div>
  );
}

function Contacts() {
  const people: [string, string, number, string][] = [
    ['MO', 'Mira Okafor', 24, 'mira@northwind.test · Verified'],
    ['DL', 'Daniel Lutz', 150, 'daniel@northwind.test · Verified'],
    ['SK', 'Sena Kaya', 300, 'finance@northwind.test · Unverified'],
  ];
  const acts: [string, string, string][] = [
    [
      'Call',
      'Renewal check-in with Daniel. Wants SSO before Q1.',
      'Jonas · 2 days ago',
    ],
    [
      'Note',
      'Finance asked for invoices to a shared address.',
      'Ana · last week',
    ],
    [
      'Meeting',
      'Onboarding for the reporting team, 6 people.',
      'Jonas · 3 weeks ago',
    ],
  ];
  return (
    <div className="crm">
      <div className="crm-h">
        <div>
          <b>Northwind</b>
          <small>northwind.test · 3 contacts · from your app’s orgs</small>
        </div>
        <span className="st st-ok">customer</span>
      </div>
      <div className="crm-grid">
        <div className="crm-col">
          <h4>Contacts</h4>
          {people.map(([ini, name, h, line]) => (
            <div className="crm-p" key={name}>
              <span className="av" style={hue(h)}>
                {ini}
              </span>
              <div>
                <b>{name}</b>
                <small>{line}</small>
              </div>
            </div>
          ))}
          <h4 style={{ marginTop: 14 }}>Fields</h4>
          <dl>
            <dt>Plan</dt>
            <dd>team</dd>
            <dt>Seats</dt>
            <dd>14</dd>
            <dt>Region</dt>
            <dd>EU</dd>
          </dl>
        </div>
        <div className="crm-col">
          <h4>Activity</h4>
          {acts.map(([kind, text, who]) => (
            <div className="act" key={text}>
              <span>{kind}</span>
              <p>{text}</p>
              <small>{who}</small>
            </div>
          ))}
          <div className="act add">Log a call…</div>
        </div>
      </div>
    </div>
  );
}

function Deals() {
  return (
    <div className="board">
      {BOARD.map(([stage, deals]) => (
        <div className="b-col" key={stage}>
          <div className="b-h">
            <b>{stage}</b>
            <span>Total {usd(deals.reduce((sum, d) => sum + d[2], 0))}</span>
          </div>
          {deals.map(([company, name, value, age]) => (
            <div className="b-card" key={company}>
              <b>{company}</b>
              <span>{name}</span>
              <div>
                <em>{usd(value)}</em>
                <small>{age} in stage</small>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
