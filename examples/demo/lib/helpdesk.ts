import { buildHelpdesk, type Identity, postgresAdapter } from 'better-helpdesk';
import pg from 'pg';

import { type DemoRole, ROLE_COOKIE, roleFromCookie } from './role';

/**
 * Anyone who sets a cookie becomes an agent here, which is the point of a demo
 * and a breach anywhere else.
 */
if (
  process.env.NODE_ENV === 'production' &&
  process.env.DEMO_UNSAFE_AUTH !== '1'
) {
  throw new Error(
    'This demo hands the agent UI to anyone who sets a cookie. Set DEMO_UNSAFE_AUTH=1 to run it in production anyway.'
  );
}

const connectionString = process.env.HELPDESK_DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'Set HELPDESK_DATABASE_URL (see examples/demo/README.md) and run `npm run db:migrate` first.'
  );
}

// next dev re-evaluates this module on every edit; a fresh pool each time
// exhausts the server's connections within a few minutes.
const cache = globalThis as typeof globalThis & { demoPool?: pg.Pool };
cache.demoPool ??= new pg.Pool({ connectionString });
export const pool = cache.demoPool;

/** Stable ids, so switching back and forth returns you to the same person. */
const IDENTITIES = {
  customer: {
    user: {
      id: 'demo-customer',
      email: 'nadia@brightline.test',
      emailVerified: true,
      name: 'Nadia Olufemi',
    },
    orgs: [{ id: 'demo-org', name: 'Brightline Logistics' }],
    isAgent: false,
  },
  agent: {
    user: {
      id: 'demo-agent',
      email: 'rowan@harbor.test',
      emailVerified: true,
      name: 'Rowan Vester',
    },
    orgs: [],
    isAgent: true,
  },
} satisfies Record<Exclude<DemoRole, 'visitor'>, Identity>;

export const helpdesk = buildHelpdesk({
  db: postgresAdapter({ pool }),
  referencePrefix: 'HRB',
  teamName: { en: 'the Harbor crew' },
  // The same-origin check reads this, so a hard-coded production URL would
  // refuse every mutation from localhost.
  adminUrl: `${process.env.DEMO_URL ?? 'http://localhost:3000'}/helpdesk/`,
  inboxes: {
    support: {
      name: { en: 'Support' },
      public: true,
      title: { en: 'Harbor support' },
      replyPromise: { en: 'We answer within a few hours on weekdays.' },
      receipt: true,
      privacyUrl: { en: '/privacy/' },
    },
    sales: {
      name: { en: 'Sales' },
      public: true,
      defaultPriority: 'high',
      title: { en: 'Talk to sales' },
      privacyUrl: { en: '/privacy/' },
      qualify: {
        label: {
          en: 'How many shipments do you move a month?',
          de: 'Wie viele Sendungen bewegen Sie pro Monat?',
        },
        options: [
          {
            value: 'under-500',
            label: { en: 'Under 500', de: 'Unter 500' },
          },
          {
            value: '500-5000',
            label: { en: '500 to 5,000', de: '500 bis 5.000' },
          },
          {
            value: 'over-5000',
            label: { en: 'More than 5,000', de: 'Mehr als 5.000' },
          },
        ],
      },
    },
  },
  // Where a real host would ask its billing system; the company card shows it.
  resolveContext: async (externalOrgId): Promise<Record<string, string>> =>
    externalOrgId === 'demo-org'
      ? {
          Plan: 'Growth, billed yearly',
          'Shipments this month': '3,412 of 5,000',
          Seats: '14 of 20',
          'Customer since': 'March 2024',
        }
      : {},
  identify: async request => {
    const cookie = new RegExp(`(?:^|;\\s*)${ROLE_COOKIE}=([^;]*)`).exec(
      request.headers.get('cookie') ?? ''
    );
    const role = roleFromCookie(cookie?.[1]);
    return role === 'visitor' ? null : IDENTITIES[role];
  },
  // No mail server in a demo: the terminal is the inbox.
  email: {
    send: async message => {
      console.log(`[helpdesk email] ${message.kind} → ${message.to}`, message);
    },
  },
  // The README's Slack recipe, with the terminal standing in for Slack.
  onEvent: async event => {
    if (event.kind !== 'conversation.created') return;
    const { conversation } = event;
    console.log(
      `[helpdesk event] New ${conversation.type} ${helpdesk.reference(conversation)}: ${conversation.subject}`
    );
  },
});
