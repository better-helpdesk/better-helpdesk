import { buildHelpdesk, postgresAdapter } from 'better-helpdesk';

import { auth } from './auth';
import { sendMail } from './mail';
import { pool, siteUrl } from './site';

export const API = '/helpdesk/api';

export const helpdesk = buildHelpdesk({
  db: postgresAdapter({ pool }),
  referencePrefix: 'BH',
  basePath: API,
  // The same-origin check reads this, so it must be the origin visitors open.
  adminUrl: `${siteUrl()}/helpdesk/`,
  teamName: { en: 'Better Helpdesk' },
  inboxes: {
    support: {
      name: { en: 'Questions' },
      public: true,
      title: { en: 'Ask a question' },
      replyPromise: {
        en: 'We read every message and usually reply within two working days.',
      },
    },
    partners: {
      name: { en: 'Supporter stories' },
      public: true,
      defaultPriority: 'high',
      receipt: true,
    },
    continuity: {
      name: { en: 'Continuity list' },
      public: true,
    },
  },
  identify: async request => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return null;
    const { id, name, email, emailVerified } = session.user;
    return {
      user: { id, name, email, emailVerified },
      orgs: [],
      isAgent: true,
    };
  },
  email: { send: sendMail },
});
