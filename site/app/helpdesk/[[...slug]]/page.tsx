import { HelpdeskAdmin } from 'better-helpdesk/admin';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { currentSession } from '../../../lib/auth';
import { API } from '../../../lib/helpdesk';
import { SignOut } from '../../components/sign-out';
import { SiteFooter, SiteHeader } from '../../components/site-chrome';

export const metadata: Metadata = {
  title: 'Inbox',
  robots: { index: false, follow: false },
};

// The API checks the session again on every call; this only spares a signed-out
// visitor an inbox that cannot load.
export default async function Page() {
  const session = await currentSession();
  if (!session) redirect('/login/');
  return (
    <>
      <SiteHeader
        end={
          <>
            <span className="nav-who">
              Signed in as <b>{session.user.name || session.user.email}</b>
            </span>
            <SignOut />
          </>
        }
      />
      <main className="inbox-page">
        <HelpdeskAdmin api={API} basePath="/helpdesk" locale="en" />
      </main>
      <SiteFooter />
    </>
  );
}
