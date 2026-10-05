'use client';

import { useEffect, useRef, useState } from 'react';

import { PLANS, usd } from '../../lib/content';

const MAX_SEATS = 25;
const MAX = Math.max(...PLANS.map(([, price]) => price)) * MAX_SEATS * 12;
const CELLS = 42;

const lit = (year: number) =>
  year > 0 ? Math.max(1, Math.round((year / MAX) * CELLS)) : 0;

/** A bar of cells; on change only the cells between old and new switch, one after another. */
export function Cells({ year }: { year: number }) {
  const now = lit(year);
  const was = useRef(now);
  const from = was.current;
  useEffect(() => {
    was.current = now;
  }, [now]);
  const lo = Math.min(from, now);
  return (
    <span className="c-bar" aria-hidden="true">
      {Array.from({ length: CELLS }, (_, i) => (
        <i
          // biome-ignore lint/suspicious/noArrayIndexKey: cells are positions, not items
          key={i}
          className={i < now ? 'on' : undefined}
          style={{
            transitionDelay: `${i >= lo && i < Math.max(from, now) ? (now > from ? i - lo : Math.max(from, now) - 1 - i) * 12 : 0}ms`,
          }}
        />
      ))}
    </span>
  );
}

export function Cost() {
  const [seats, setSeats] = useState(5);
  return (
    <div className="cost-grid">
      <div className="cost-ctl">
        <label htmlFor="seats">Support agents</label>
        <output htmlFor="seats">
          {seats} {seats === 1 ? 'agent' : 'agents'}
        </output>
        <input
          id="seats"
          type="range"
          min={1}
          max={MAX_SEATS}
          value={seats}
          onChange={e => setSeats(Number(e.target.value))}
        />
      </div>
      <div className="cost-list">
        {PLANS.map(([name, price]) => {
          const year = price * seats * 12;
          return (
            <div className="c-row" key={name}>
              <span className="c-n">
                {name}
                <small>${price} per agent per month</small>
              </span>
              <Cells year={year} />
              <b className="c-v">
                {usd(year)}
                <small>
                  <span>/</span>year
                </small>
              </b>
            </div>
          );
        })}
        <div className="c-row us">
          <span className="c-n">
            Better Helpdesk
            <small>$0 per agent per month</small>
          </span>
          <Cells year={0} />
          <b className="c-v">
            $0
            <small>
              <span>/</span>year
            </small>
          </b>
        </div>
      </div>
    </div>
  );
}
