import { HelpdeskWidget } from 'better-helpdesk/widget';

import { currentRole } from '../lib/role';
import { Bar, Foot, RoleSwitcher } from './chrome';

export default async function Page() {
  const role = await currentRole();

  return (
    <>
      <Bar here="site" />
      <main id="main" className="shell">
        <section className="hero">
          <div className="rise">
            <p className="eyebrow">better-helpdesk · live demo</p>
            <h1>
              Harbor moves freight. Its <em>support</em> is a dependency.
            </h1>
            <p className="lede">
              Everything you can click here — the launcher in the corner, the
              inbox at <code>/helpdesk</code> — is the package, running against
              a real Postgres. The rest of the page is scenery.
            </p>
            <div className="actions">
              <a className="btn" href="/helpdesk/">
                Open the agent inbox
                <span className="btn-icon" aria-hidden="true">
                  →
                </span>
              </a>
              <a
                className="btn btn-quiet"
                href="https://github.com/better-helpdesk/better-helpdesk#readme">
                Read the setup
              </a>
            </div>
          </div>

          <div className="tray rise">
            <div className="card">
              <h2>What to try</h2>
              <p>About two minutes, in this order.</p>
              <ol className="steps">
                <li>
                  Open the launcher at the bottom right and send a message. You
                  get a reference like <code>HRB-1042</code>.
                </li>
                <li>
                  Switch to Rowan below, open the inbox, and answer it. The
                  reply shows up in the widget without a refresh.
                </li>
                <li>
                  Flip the dark switch. Both UIs follow, because they read the
                  same CSS custom properties this page sets.
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section className="band">
          <div className="band-head">
            <h2>Who you are right now</h2>
            <p>
              A cookie, nothing more — this demo has no real authentication.
            </p>
          </div>
          <RoleSwitcher role={role} />
        </section>
      </main>
      <Foot />
      <HelpdeskWidget inbox="support" locale="en" />
    </>
  );
}
