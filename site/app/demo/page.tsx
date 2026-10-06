import { HelpdeskWidget } from 'better-helpdesk/widget';
import type { Metadata } from 'next';

import { DEMO_API, demoEnabled, RESET_MINUTES } from '../../lib/demo';
import { ButtonIcon } from '../components/icons';
import { SiteFooter, SiteHeader } from '../components/site-chrome';
import { currentRole, RoleSwitcher } from './chrome';
import { BrokenButton, ResetCountdown } from './parts';

export const metadata: Metadata = {
  title: 'Demo',
  description:
    'Try Better Helpdesk without installing it: send a message from the widget, then answer it from the agent inbox.',
};

export default async function Demo() {
  const role = await currentRole();
  const enabled = demoEnabled();
  return (
    <>
      <SiteHeader />
      <main className="qs" id="top">
        <section className="qs-hero">
          <span className="eyebrow">Live demo</span>
          <h1>Be the customer, then the agent.</h1>
          <p className="sub">
            Harbor is a pretend freight product with the published package
            installed: the launcher in the corner and the inbox are the real
            thing, on their own Postgres. Everyone shares this inbox, and it
            starts over <ResetCountdown minutes={RESET_MINUTES} />.
          </p>
        </section>
        {enabled ? (
          <>
            <ol className="qs-steps">
              <li className="qs-step" id="who">
                <span className="qs-n" aria-hidden="true">
                  01
                </span>
                <div className="qs-body">
                  <h2>Pick who you are</h2>
                  <p>
                    A cookie, nothing more. A real host passes its own login to{' '}
                    <code>identify</code>.
                  </p>
                  <RoleSwitcher role={role} />
                </div>
              </li>
              <li className="qs-step">
                <span className="qs-n" aria-hidden="true">
                  02
                </span>
                <div className="qs-body">
                  <h2>Write in</h2>
                  <p>
                    Open the launcher at the bottom right and send a message.
                    Press the broken button first and report a bug: the form
                    offers the error it caught.
                  </p>
                  <div className="row-cta">
                    <BrokenButton />
                  </div>
                </div>
              </li>
              <li className="qs-step">
                <span className="qs-n" aria-hidden="true">
                  03
                </span>
                <div className="qs-body">
                  <h2>Answer it</h2>
                  <p>
                    Become Rowan and open the inbox. Your reply shows up in the
                    widget without a refresh. Nothing is emailed: the demo has
                    no mail adapter.
                  </p>
                  <div className="row-cta">
                    <a className="btn btn-p" href="/demo/inbox/">
                      Open the agent inbox
                      <ButtonIcon />
                    </a>
                  </div>
                </div>
              </li>
            </ol>
            <HelpdeskWidget
              api={DEMO_API}
              inbox="support"
              locale="en"
              appVersion="harbor@4.12.0"
            />
          </>
        ) : (
          <section className="qs-next">
            <p className="sub">The demo is not set up on this server.</p>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
