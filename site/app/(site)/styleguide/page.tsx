import type { Metadata } from 'next';

import { Install } from '../components/copy';
import { ButtonIcon } from '../components/icons';
import { Face, Ident, Mark } from '../components/mark';
import { SiteFooter, SiteHeader } from '../components/site-chrome';
import { MotionDemos } from './motion-demos';

export const metadata: Metadata = {
  title: 'Styleguide',
  description: 'The Better Helpdesk mark, motion, tokens and components.',
  robots: { index: false },
};

const COLOURS: [string, string, string][] = [
  ['--bg', '#0b0d0c', 'Ground'],
  ['--s1', '#111413', 'Tray'],
  ['--s2', '#171b19', 'Core'],
  ['--s3', '#202623', 'Control'],
  ['--s4', '#2a312d', 'Raised control'],
  ['--fg', '#eef3f0', 'Paper'],
  ['--fg-2', '#a7b1ab', 'Body'],
  ['--fg-3', '#8b948f', 'Labels'],
  ['--mint', '#9ad9b8', 'Mint: who to look at next'],
  ['--wait', '#f1d27a', 'Butter: waiting'],
  ['--late', '#f0907f', 'Coral: urgent, late'],
];

const MOTION: [string, string, string][] = [
  ['State change', '150ms', 'steps(2)'],
  ['Arrival on scroll', 'entry 0–35%', 'scroll-driven, linear'],
  ['Blink', '120ms', 'instant on and off'],
  ['Mouth cells', '70ms apart', 'instant on and off'],
  ['Dither', '160ms + 200ms', '8 steps'],
  ['Cell fill', '12ms apart', 'instant on and off'],
  ['Panel open', '240ms', 'steps(4)'],
  ['Row arrival', '320ms', 'steps(4) wipe'],
];

function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sg-sec" id={id} aria-labelledby={`${id}-h`}>
      <div className="sh">
        <h2 id={`${id}-h`}>{title}</h2>
        <p className="sub">{lede}</p>
      </div>
      {children}
    </section>
  );
}

export default function Styleguide() {
  return (
    <>
      <SiteHeader />
      <main className="sg" id="top">
        <section className="sg-hero">
          <span className="eyebrow">Styleguide</span>
          <h1>Cut from one cell.</h1>
          <p className="sub">
            Everything here is built on an 8px module and the mark's own 5×5
            grid. Motion moves whole cells, never smooth gradients.
          </p>
          <nav className="sg-index" aria-label="On this page">
            <a href="#mark">Mark</a>
            <a href="#motion">Motion</a>
            <a href="#tokens">Tokens</a>
            <a href="#components">Components</a>
          </nav>
        </section>

        <Section
          id="mark"
          title="The mark"
          lede="An identicon that smiles: a mirrored 5×5 grid with half a cell of padding. Black and white only; mint backs it only where it marks the next person to answer.">
          <div className="sg-grid">
            <div className="sg-card">
              <h3>Construction</h3>
              <div className="sg-construct">
                <Mark fg="#fff" bg="#000" />
              </div>
              <p>
                6 × 6 units. Eyes two cells tall, a three-cell smile with
                corners.
              </p>
            </div>
            <div className="sg-card">
              <h3>Sizes</h3>
              <div className="sg-row">
                {[24, 48, 72, 96].map(size => (
                  <span key={size} className="sg-size">
                    <span className={`mk mk-${size}`}>
                      <Mark fg="#fff" bg="#000" />
                    </span>
                    <small>
                      {size}px · cell {size / 6}px
                    </small>
                  </span>
                ))}
              </div>
              <p>Only multiples of 6, so every cell lands on whole pixels.</p>
            </div>
            <div className="sg-card">
              <h3>Colourways</h3>
              <div className="sg-row">
                <span className="mk mk-72">
                  <Mark fg="#fff" bg="#000" />
                </span>
                <span className="mk mk-72">
                  <Mark fg="#000" bg="#fff" />
                </span>
                <span className="mk mk-72">
                  <Mark fg="#0b0d0c" bg="#9ad9b8" />
                </span>
              </div>
              <p>
                White on black, black on white. Mint for the launcher and faces
                in the product.
              </p>
            </div>
            <div className="sg-card">
              <h3>Faces</h3>
              <div className="sg-row">
                {(['smile', 'flat', 'sleep'] as const).map(mood => (
                  <span key={mood} className="sg-size">
                    <span className="mk mk-72">
                      <Face mood={mood} fg="var(--bg)" bg="var(--mint)" />
                    </span>
                    <small>{mood}</small>
                  </span>
                ))}
              </div>
              <p>Site art around the product. The logo itself always smiles.</p>
            </div>
          </div>
        </Section>

        <Section
          id="motion"
          title="Motion"
          lede="Each animation has one job. All of them stop under reduced motion and show their final state.">
          <MotionDemos />
          <table className="sg-table">
            <thead>
              <tr>
                <th scope="col">Moment</th>
                <th scope="col">Duration</th>
                <th scope="col">Timing</th>
              </tr>
            </thead>
            <tbody>
              {MOTION.map(([moment, duration, timing]) => (
                <tr key={moment}>
                  <th scope="row">{moment}</th>
                  <td>{duration}</td>
                  <td>{timing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          id="tokens"
          title="Tokens"
          lede="Green-black ground, paper type, one mint accent. Butter and coral only ever describe waiting time.">
          <div className="sg-swatches">
            {COLOURS.map(([token, hex, role]) => (
              <div key={token} className="sg-swatch">
                <i style={{ background: `var(${token})` }} />
                <b>{role}</b>
                <code>
                  {token} · {hex}
                </code>
              </div>
            ))}
          </div>
          <div className="sg-type">
            <div>
              <small>Display · Doto 900 · caps</small>
              <span className="sg-t1">Inside your app</span>
            </div>
            <div>
              <small>Heading · Doto 800 · caps</small>
              <span className="sg-t2">Four routes, one schema</span>
            </div>
            <div>
              <small>Body · Rethink Sans 400</small>
              <span className="sg-t3">
                Conversations live in a helpdesk schema inside the Postgres you
                already run.
              </span>
            </div>
            <div>
              <small>Mono · Martian Mono</small>
              <span className="sg-t4">ACME-1042 · waiting 4m</span>
            </div>
          </div>
          <div className="sg-notches">
            {[3, 4, 5, 6, 8].map(n => (
              <span key={n} style={{ '--n': `${n}px` } as React.CSSProperties}>
                notch {n}
              </span>
            ))}
          </div>
        </Section>

        <Section
          id="components"
          title="Components"
          lede="Each in its states: default, hover, focus, pressed, disabled, invalid.">
          <div className="sg-grid">
            <div className="sg-card">
              <h3>Buttons</h3>
              <div className="sg-row">
                <a className="btn btn-p" href="#components">
                  Primary
                  <ButtonIcon />
                </a>
                <a className="btn btn-p btn-sm" href="#components">
                  Small
                  <ButtonIcon />
                </a>
                <button className="btn btn-p" type="button" disabled>
                  Disabled
                  <ButtonIcon />
                </button>
              </div>
            </div>
            <div className="sg-card">
              <h3>Install command</h3>
              <Install />
              <p>The copy icon's cells rearrange into a check.</p>
            </div>
            <div className="sg-card">
              <h3>Status and priority</h3>
              <div className="sg-row">
                <span className="st st-wait">Waiting 4m</span>
                <span className="st st-ok">Resolved</span>
                <span className="pr">normal</span>
                <span className="pr pr-high">high</span>
                <span className="pr pr-urgent">urgent</span>
                <span className="pr pr-sent">reminded</span>
              </div>
              <div className="sg-row">
                <span className="a-wait">1h 12m</span>
                <span className="a-wait warn">7h</span>
                <span className="a-wait late">26h</span>
              </div>
            </div>
            <div className="sg-card">
              <h3>People</h3>
              <div className="sg-row">
                <span
                  className="av"
                  style={{ '--h': 24 } as React.CSSProperties}>
                  MO
                </span>
                <span
                  className="av"
                  style={{ '--h': 190 } as React.CSSProperties}>
                  TB
                </span>
                <span className="mk mk-48">
                  <Ident name="Mira Okafor" fg="var(--fg)" bg="var(--s2)" />
                </span>
                <span className="mk mk-48">
                  <Ident name="Kofi Mensah" fg="var(--fg)" bg="var(--s2)" />
                </span>
              </div>
              <p>Initials in the product today; identicons as brand art.</p>
            </div>
            <div className="sg-card">
              <h3>Keys</h3>
              <div className="sg-row">
                <kbd>j</kbd>
                <kbd>k</kbd>
                <kbd className="on">↵</kbd>
              </div>
            </div>
            <div className="sg-card">
              <h3>Fields</h3>
              <form className="partner sg-form">
                <label htmlFor="sg-a">
                  Name
                  <input id="sg-a" placeholder="Mira Okafor" />
                </label>
                <label htmlFor="sg-b">
                  Work email
                  <input id="sg-b" aria-invalid placeholder="mira@northwind" />
                </label>
                <p className="f-msg err">
                  Enter a work email like name@company.test.
                </p>
              </form>
            </div>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
