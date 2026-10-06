import { HelpdeskAdmin } from 'better-helpdesk/admin';
import type { Metadata } from 'next';

import { DEMO_API } from '../../../../../lib/demo';
import { SiteFooter, SiteHeader } from '../../../components/site-chrome';
import { TextLink } from '../../../components/text-link';
import { currentRole, RoleSwitcher } from '../../chrome';

export const metadata: Metadata = {
  title: 'Demo inbox',
  robots: { index: false, follow: false },
};

export default async function Page() {
  const role = await currentRole();
  return (
    <>
      <SiteHeader
        end={
          <>
            <span className="nav-who">
              <b>Demo</b> inbox
            </span>
            <TextLink href="/demo/">Back to the demo</TextLink>
          </>
        }
      />
      <main className="inbox-page">
        {role === 'agent' ? (
          <HelpdeskAdmin api={DEMO_API} basePath="/demo/inbox" locale="en" />
        ) : (
          <div className="qs">
            <section className="qs-hero">
              <h1>Only agents get this far.</h1>
              <p className="sub">
                The inbox refuses anyone whose identity is not an agent. Become
                Rowan and it opens.
              </p>
              <RoleSwitcher role={role} />
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
