import { HelpdeskAdmin } from 'better-helpdesk/admin';
import type { Metadata } from 'next';

import { API } from '../../../lib/helpdesk';

export const metadata: Metadata = {
  title: 'Inbox',
  robots: { index: false, follow: false },
};

// proxy.ts has already asked for the agent's credentials; the API checks them
// again on every call.
export default function Page() {
  return (
    <div className="inbox-page">
      <HelpdeskAdmin api={API} basePath="/helpdesk" locale="en" />
    </div>
  );
}
