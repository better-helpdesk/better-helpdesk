import {
  type BusinessHours,
  buildHelpdesk,
  type HelpResult,
  type Identity,
  postgresAdapter,
  postgresRealtime,
} from 'better-helpdesk';
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
  platinum: {
    user: {
      id: 'demo-platinum',
      email: 'jonas@nordkai.test',
      emailVerified: true,
      name: 'Jonas Weber',
    },
    orgs: [{ id: 'demo-org-nordkai', name: 'Nordkai Shipping' }],
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
  supervisor: {
    user: {
      id: 'demo-supervisor',
      email: 'mina@harbor.test',
      emailVerified: true,
      name: 'Mina Okonjo',
    },
    orgs: [],
    isAgent: true,
    role: 'supervisor',
  },
  viewer: {
    user: {
      id: 'demo-viewer',
      email: 'theo@harbor.test',
      emailVerified: true,
      name: 'Theo Lindqvist',
    },
    orgs: [],
    isAgent: true,
    role: 'viewer',
  },
} satisfies Record<Exclude<DemoRole, 'visitor'>, Identity>;

/** The support tier of each customer organization, as Harbor's billing would know it; Brightline is on standard support and has none. */
const TIERS: Record<string, string> = {
  'demo-org-nordkai': 'premium',
};

const office: BusinessHours = {
  timeZone: 'Europe/Zurich',
  weekly: Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri'].map(d => [d, [['08:00', '18:00']]])
  ),
};

// A few invented articles, so the widget's documentation search has something to find.
const ARTICLES: HelpResult[] = [
  {
    title: 'Track a shipment',
    url: 'https://docs.harbor.test/shipments/track',
    excerpt:
      'Shipments › Every update from pickup to delivery, and who gets told.',
  },
  {
    title: 'Export shipments to CSV',
    url: 'https://docs.harbor.test/shipments/export',
    excerpt: 'Shipments › Pick the columns and the date range, then download.',
  },
  {
    title: 'Invite your team',
    url: 'https://docs.harbor.test/account/team',
    excerpt:
      'Account › Add colleagues and choose what each of them can change.',
  },
];

export const helpdesk = buildHelpdesk({
  db: postgresAdapter({ pool }),
  // Every instance hears the others' changes, so replies show without a reload.
  realtime: postgresRealtime({ pool }),
  help: {
    search: async query => {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      return ARTICLES.filter(a =>
        words.some(w => `${a.title} ${a.excerpt}`.toLowerCase().includes(w))
      );
    },
  },
  referencePrefix: 'HRB',
  teamName: { en: 'the Harbor crew' },
  // Harbor's own priority ladder, lowest first; the agent UI and the widget show them as named below.
  priorities: ['p3', 'p2', 'p1'],
  // Short targets, so a warning and a breach can be watched within a demo.
  tiers: ['priority', 'premium'],
  resolveTier: async ({ orgId, email }) =>
    (orgId && TIERS[orgId]) ??
    (email?.endsWith('@nordkai.test') ? 'premium' : null),
  sla: {
    tiers: {
      priority: {
        targets: {
          p1: { respond: 0.25, resolve: 1, hours: 'always' },
          p2: { respond: 0.5, resolve: 2, hours: 'always' },
          p3: { respond: 4, resolve: 24, hours: office },
        },
      },
      premium: {
        targets: {
          p1: { respond: 0.1, resolve: 0.5, hours: 'always' },
          p2: { respond: 0.25, resolve: 1, hours: 'always' },
          p3: { respond: 2, resolve: 8, hours: office },
        },
      },
    },
    // Standard support: a best-effort reply within a working day, nothing on resolution.
    default: { targets: { p3: { respond: 8, hours: office } } },
    warnAt: 0.5,
  },
  priorityLabels: {
    p1: { en: 'P1', de: 'P1' },
    p2: { en: 'P2', de: 'P2' },
    p3: { en: 'P3', de: 'P3' },
  },
  ratingScale: 5,
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
      // Premium customers raise P1 to P3 themselves; the definitions are the support policy's.
      priorities: {
        options: {
          p1: {
            en: 'Complete loss of functionality, damaging public content, or a security vulnerability.',
          },
          p2: {
            en: 'A key function is unavailable or an urgent action is impossible.',
          },
          p3: {
            en: 'Partial functionality, a display or behaviour error, or performance.',
          },
        },
        tiers: ['premium'],
      },
    },
    sales: {
      name: { en: 'Sales' },
      public: true,
      defaultPriority: 'p2',
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
  // The README's Slack recipe, with the terminal standing in for Slack and
  // for the pager an SLA breach on a P1 would open.
  onEvent: async event => {
    const { conversation } = event;
    if (event.kind === 'conversation.created') {
      console.log(
        `[helpdesk event] New ${conversation.type} ${helpdesk.reference(conversation)}: ${conversation.subject}`
      );
    } else if (event.kind === 'sla.warning' || event.kind === 'sla.breach') {
      console.log(
        `[helpdesk ${event.kind}] ${helpdesk.reference(conversation)} ${event.target} target${
          event.kind === 'sla.breach' ? ' missed, was' : ''
        } due ${event.due.toISOString()}${
          event.kind === 'sla.breach' && conversation.priority === 'urgent'
            ? ' → PagerDuty incident would open here'
            : ''
        }`
      );
    }
  },
});
