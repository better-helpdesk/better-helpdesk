'use client';

import { useRef, useState } from 'react';

import { Cells } from '../components/cost';
import { dither } from '../components/dither';
import { LiveMark, MarkFrame } from '../components/live-mark';
import { Face, type Mood } from '../components/mark';

function Demo({
  name,
  use,
  spec,
  children,
}: {
  name: string;
  use: string;
  spec: string;
  children: React.ReactNode;
}) {
  return (
    <article className="sg-demo">
      <div className="sg-stage">{children}</div>
      <h3>{name}</h3>
      <p>{use}</p>
      <code>{spec}</code>
    </article>
  );
}

export function MotionDemos() {
  const [shut, setShut] = useState(false);
  const [wink, setWink] = useState(false);
  const [mood, setMood] = useState<Mood>('flat');
  const [seats, setSeats] = useState(5);
  const [row, setRow] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [face, setFace] = useState(0);

  const blink = () => {
    setShut(true);
    setTimeout(() => setShut(false), 120);
  };
  const dissolve = async () => {
    if (!box.current || !canvas.current) return;
    await dither(canvas.current, box.current, true, 160);
    setFace(f => (f + 1) % 3);
    await dither(canvas.current, box.current, false, 200);
  };

  return (
    <div className="sg-demos">
      <Demo
        name="Blink"
        use="The logo's only animation: nav, launcher, footer, closing call to action."
        spec="eyes 2 cells → 1 cell for 120ms · every 4–7s at random · 1 in 4 is a double blink">
        <span className="mk mk-96">
          <MarkFrame
            fg="var(--bg)"
            bg="var(--mint)"
            eyes={shut ? 'shut' : 'open'}
          />
        </span>
        <button type="button" className="sg-btn" onClick={blink}>
          Blink
        </button>
      </Demo>
      <Demo
        name="Idle blink"
        use="What the mark does on its own, wherever it appears."
        spec="LiveMark · off under reduced motion">
        <span className="mk mk-96">
          <LiveMark fg="#fff" bg="#000" />
        </span>
      </Demo>
      <Demo
        name="Wink"
        use="The launcher acknowledges a pointer over it."
        spec="right eye 1 cell while hovered · no transition">
        <button
          type="button"
          className="launch"
          aria-label="Hover to wink"
          onPointerEnter={() => setWink(true)}
          onPointerLeave={() => setWink(false)}
          onFocus={() => setWink(true)}
          onBlur={() => setWink(false)}>
          <MarkFrame
            fg="var(--bg)"
            bg="var(--mint)"
            eyes={wink ? 'wink' : 'open'}
          />
        </button>
      </Demo>
      <Demo
        name="Moods"
        use="Faces around the product only: the queue, the FAQ, the continuity strip, the 404."
        spec="mouth cells switch one at a time, 70ms apart · flat · smile · sleep">
        <span className="mk mk-96">
          <Face mood={mood} fg="var(--bg)" bg="var(--mint)" />
        </span>
        <fieldset className="seg">
          <legend className="vh">Mood</legend>
          {(['flat', 'smile', 'sleep'] as const).map(m => (
            <button
              key={m}
              type="button"
              aria-pressed={mood === m}
              onClick={() => setMood(m)}>
              {m}
            </button>
          ))}
        </fieldset>
      </Demo>
      <Demo
        name="Dither dissolve"
        use="Any change of view inside the product frame, and its first reveal."
        spec="8px cells in 4×4 Bayer order · cover 160ms, clear 200ms · 8 steps">
        <div className="sg-dither" ref={box}>
          <div className="dither" aria-hidden="true">
            <canvas ref={canvas} />
          </div>
          <span className="mk mk-72">
            <Face
              mood={(['flat', 'smile', 'sleep'] as const)[face] ?? 'flat'}
              fg="var(--bg)"
              bg="var(--mint)"
            />
          </span>
        </div>
        <button type="button" className="sg-btn" onClick={dissolve}>
          Dissolve
        </button>
      </Demo>
      <Demo
        name="Cell fill"
        use="Every bar on the site: cells switch one by one between the old and the new value."
        spec="40 cells · 12ms apart · on or off, never scaled">
        <div className="sg-cells">
          <Cells year={seats * 55 * 12} />
        </div>
        <input
          type="range"
          min={1}
          max={25}
          value={seats}
          aria-label="Agents"
          onChange={e => setSeats(Number(e.target.value))}
        />
      </Demo>
      <Demo
        name="Step selection"
        use="The inbox's selected row, moved with j and k."
        spec="one highlight · 160ms · steps(2)">
        <ul className="sg-rows">
          <li
            className="a-sel"
            aria-hidden="true"
            style={{ transform: `translateY(${row * 40}px)` }}
          />
          {['ACME-1036', 'ACME-1039', 'ACME-1041'].map(ref => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
        <span className="sg-pair">
          <button
            type="button"
            className="sg-btn"
            onClick={() => setRow(r => Math.min(2, r + 1))}>
            j
          </button>
          <button
            type="button"
            className="sg-btn"
            onClick={() => setRow(r => Math.max(0, r - 1))}>
            k
          </button>
        </span>
      </Demo>
    </div>
  );
}
