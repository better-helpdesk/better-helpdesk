import { buildHelpdesk, postgresAdapter } from 'better-helpdesk';
import pg from 'pg';

import { isAgentRequest } from './agent';
import { sendMail } from './mail';

export const API = '/helpdesk/api';
export const siteUrl = () =>
  (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// next dev re-evaluates this module on every edit; a fresh pool each time
// exhausts the server's connections within a few minutes.
const cache = globalThis as typeof globalThis & { sitePool?: pg.Pool };
cache.sitePool ??= new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export const helpdesk = buildHelpdesk({
  db: postgresAdapter({ pool: cache.sitePool }),
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
    if (!isAgentRequest(request.headers)) return null;
    return {
      user: {
        id: 'site-agent',
        name:
          process.env.SITE_AGENT_NAME ?? process.env.SITE_AGENT_USER ?? null,
        email: process.env.SITE_AGENT_EMAIL ?? null,
        emailVerified: true,
      },
      orgs: [],
      isAgent: true,
    };
  },
  email: { send: sendMail },
});
