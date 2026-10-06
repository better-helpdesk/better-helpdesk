import { buildHelpdesk, type Identity, postgresAdapter } from 'better-helpdesk';
import pg from 'pg';

import { siteUrl } from './site';

/**
 * The public demo at /demo: Harbor, a pretend freight product, with its own
 * helpdesk in its own database. Anyone can become an agent with a cookie, and
 * the inbox is wiped and seeded again every quarter hour.
 */
export const DEMO_API = '/demo/api';
export const ROLE_COOKIE = 'demo-role';
export const RESET_MINUTES = 15;

export type DemoRole = 'visitor' | 'customer' | 'agent';

export const roleFromCookie = (value: string | undefined): DemoRole =>
  value === 'customer' || value === 'agent' ? value : 'visitor';

export const demoEnabled = () => Boolean(process.env.DEMO_DATABASE_URL);

const cache = globalThis as typeof globalThis & { demoPool?: pg.Pool };
cache.demoPool ??= new pg.Pool({
  connectionString: process.env.DEMO_DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 4,
});
const pool = cache.demoPool;

export const NEWEST_ROWS_SQL = `select c.number, m.author_type, left(m.body, 80) as body, m.created_at
from helpdesk.message m join helpdesk.conversation c on c.id = m.conversation_id
where not m.internal
order by m.created_at desc limit 5`;

/** The demo's five newest customer-visible messages, read straight from its tables. */
export async function newestRows() {
  const { rows } = await pool.query<{
    number: number;
    author_type: string;
    body: string;
    created_at: Date;
  }>(NEWEST_ROWS_SQL);
  return rows;
}

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

// No email adapter: visitors type any address, and nothing may ever be sent to it.
export const demo = buildHelpdesk({
  db: postgresAdapter({ pool }),
  referencePrefix: 'HRB',
  basePath: DEMO_API,
  adminUrl: `${siteUrl()}/demo/inbox/`,
  teamName: { en: 'the Harbor crew' },
  inboxes: {
    support: {
      name: { en: 'Support' },
      public: true,
      title: { en: 'Harbor support' },
      replyPromise: { en: 'This is the demo. Answer yourself as Rowan.' },
      privacyUrl: { en: `${siteUrl()}/privacy/` },
    },
    sales: {
      name: { en: 'Sales' },
      public: true,
      defaultPriority: 'high',
      title: { en: 'Talk to sales' },
      privacyUrl: { en: `${siteUrl()}/privacy/` },
      qualify: {
        label: {
          en: 'How many shipments do you move a month?',
          de: 'Wie viele Sendungen bewegen Sie pro Monat?',
        },
        options: [
          { value: 'under-500', label: { en: 'Under 500', de: 'Unter 500' } },
          {
            value: '500-5000',
            label: { en: '500 to 5,000', de: '500 bis 5000' },
          },
          {
            value: 'over-5000',
            label: { en: 'More than 5,000', de: 'Mehr als 5000' },
          },
        ],
      },
    },
  },
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
});

/** The same server and database as the site's own inbox would be wiped with it. */
function sameDatabase(a: string, b: string) {
  const key = (url: string) => {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '5432'}${u.pathname}`;
  };
  return key(a) === key(b);
}

/**
 * Empties the demo's helpdesk schema and seeds it again. Containers that fire at
 * the same quarter hour take turns on an advisory lock; the loser skips.
 */
export async function resetDemo() {
  const url = process.env.DEMO_DATABASE_URL;
  if (!url) return;
  if (process.env.DATABASE_URL && sameDatabase(url, process.env.DATABASE_URL))
    throw new Error(
      'DEMO_DATABASE_URL names the site database; the reset would wipe the real inbox.'
    );
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>(
      "select pg_try_advisory_lock(hashtext('better-helpdesk-demo')) as ok"
    );
    if (!rows[0]?.ok) return;
    try {
      const tables = await client.query<{ name: string }>(
        `select quote_ident(tablename) as name from pg_tables
          where schemaname = 'helpdesk' and tablename <> '__migrations'`
      );
      await client.query(
        `truncate ${tables.rows.map(t => `helpdesk.${t.name}`).join(', ')} restart identity cascade`
      );
      await client.query('alter sequence helpdesk.reference_seq restart');
      await seed();
    } finally {
      await client.query(
        "select pg_advisory_unlock(hashtext('better-helpdesk-demo'))"
      );
    }
  } finally {
    client.release();
  }
}

type ConversationContext = NonNullable<
  Parameters<typeof demo.store.createConversation>[0]['context']
>;

type Thread = {
  from: { name: string; email: string; org?: 'brightline' };
  inbox: 'support' | 'sales';
  type: string;
  priority?: string;
  subject: string;
  body: string;
  context?: ConversationContext;
  segment?: string;
  replies?: { by: 'agent' | 'note' | 'contact'; body: string }[];
  resolved?: boolean;
  tags?: string[];
};

const browser = (
  path: string,
  extra: Partial<ConversationContext> = {}
): ConversationContext => ({
  url: `https://app.harbor.test${path}`,
  title: 'Harbor',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15',
  viewport: '1512×862',
  locale: 'en',
  appVersion: 'harbor@4.12.0',
  ...extra,
});

// Invented people on .test domains, as in examples/demo/scripts/seed.ts.
const THREADS: Thread[] = [
  {
    from: {
      name: 'Tomás Reyes',
      email: 'tomas@brightline.test',
      org: 'brightline',
    },
    inbox: 'support',
    type: 'bug',
    priority: 'high',
    subject: 'ETA column is blank on the shipments board',
    body: 'Since this morning the ETA column on the shipments board is empty for every container. Refreshing does not help.',
    context: browser('/shipments?view=board', {
      errors: [
        "TypeError: Cannot read properties of undefined (reading 'eta')",
      ],
    }),
    tags: ['shipments-board'],
  },
  {
    from: {
      name: 'Ingrid Halvorsen',
      email: 'ingrid@brightline.test',
      org: 'brightline',
    },
    inbox: 'support',
    type: 'question',
    subject: 'Adding a second warehouse address',
    body: 'Can we have two pickup addresses on one account? Our Rotterdam warehouse opens next month.',
    context: browser('/settings/addresses'),
    replies: [
      {
        by: 'note',
        body: 'Multiple pickup addresses are on Growth and up. Brightline is on Growth, so this is just a settings walkthrough.',
      },
      {
        by: 'agent',
        body: 'Yes: Settings → Addresses → Add pickup address. Each shipment then lets you pick which one it leaves from.',
      },
    ],
  },
  {
    from: { name: 'Kwame Mensah', email: 'kwame@saltmarsh.test' },
    inbox: 'support',
    type: 'question',
    subject: 'Export customs documents as one PDF',
    body: 'Is there a way to download all customs documents for a shipment as a single PDF?',
    context: browser('/shipments/HB-88213/documents'),
    replies: [
      {
        by: 'agent',
        body: 'There is: open the shipment, Documents, then "Download all". It bundles them into one PDF.',
      },
      { by: 'contact', body: 'Found it, thank you!' },
    ],
    resolved: true,
  },
  {
    from: { name: 'Lena Aebischer', email: 'lena@alpenfracht.test' },
    inbox: 'support',
    type: 'bug',
    priority: 'urgent',
    subject: 'Tracking link in the customer email returns 404',
    body: 'Our customers get a 404 when they click the tracking link in the shipment confirmation email.',
    context: browser('/shipments/HB-90114', {
      locale: 'de',
      viewport: '390×844',
      errors: ['Failed to fetch tracking page: 404'],
    }),
  },
  {
    from: { name: 'Priya Natarajan', email: 'priya@copperleaf.test' },
    inbox: 'support',
    type: 'feature',
    priority: 'low',
    subject: 'Dark mode for the driver app',
    body: 'Our drivers work night shifts. A dark mode in the driver app would be easier on their eyes.',
    context: browser('/drivers'),
    tags: ['driver-app'],
  },
  {
    from: {
      name: 'Amara Diallo',
      email: 'amara@brightline.test',
      org: 'brightline',
    },
    inbox: 'support',
    type: 'feature',
    subject: 'Bulk-edit pickup windows',
    body: 'Changing the pickup window on 40 shipments one by one takes forever. Could we select several and change them at once?',
    context: browser('/shipments'),
  },
  {
    from: { name: 'Mateo Rossi', email: 'mateo@vialattea.test' },
    inbox: 'sales',
    type: 'lead',
    subject: 'Pricing for 8,000 shipments a month',
    body: 'We move around 8,000 shipments a month across Italy and Switzerland. What would Harbor cost us, and do you integrate with SAP?',
    segment: 'over-5000',
    context: {
      ...browser('/pricing'),
      landingPage: 'https://app.harbor.test/pricing',
      referrer: 'https://search.example.test/',
      utm: { source: 'newsletter', campaign: 'autumn' },
    },
  },
  {
    from: { name: 'Sophie Laurent', email: 'sophie@petitport.test' },
    inbox: 'sales',
    type: 'lead',
    subject: 'Trial for a small forwarder',
    body: 'We are a team of five. Is there a trial, and can we import our existing shipments from a spreadsheet?',
    segment: 'under-500',
    context: browser('/pricing'),
  },
  {
    from: { name: 'Hana Sato', email: 'hana@tidewater.test' },
    inbox: 'support',
    type: 'bug',
    subject: 'Label printer prints a blank page',
    body: 'Printing a shipping label gives us a blank page on our Zebra printer. PDF download works fine.',
    context: browser('/shipments/HB-90377/label', {
      errors: [
        'Unhandled rejection: PrinterError: no media size for 4x6',
        "TypeError: Cannot read properties of null (reading 'getContext')",
      ],
    }),
  },
];

async function seed() {
  const { store } = demo;
  const rowan = await store.touchAgent({
    externalUserId: 'demo-agent',
    name: 'Rowan Vester',
    email: 'rowan@harbor.test',
  });
  const brightline = await store.upsertCompany(
    'demo-org',
    'Brightline Logistics'
  );
  await store.updateCompany(brightline.id, { domain: 'brightline.test' });

  for (const thread of THREADS) {
    const companyId = thread.from.org === 'brightline' ? brightline.id : null;
    const contact = await store.createContact(
      {
        name: thread.from.name,
        email: thread.from.email,
        companyId,
        locale: thread.context?.locale ?? 'en',
        leadStage: thread.inbox === 'sales' ? 'lead' : null,
        tags: thread.segment ? [thread.segment] : [],
      },
      { channel: 'email', externalId: thread.from.email, verified: false }
    );
    const { conversation } = await store.createConversation(
      {
        inbox: thread.inbox,
        type: thread.type,
        priority:
          thread.priority ?? (thread.inbox === 'sales' ? 'high' : 'normal'),
        subject: thread.subject,
        contactId: contact.id,
        companyId,
        tags: thread.tags ?? [],
        context: {
          ...thread.context,
          ...(thread.segment
            ? { host: { ...thread.context?.host, segment: thread.segment } }
            : {}),
        },
      },
      { body: thread.body, contactId: contact.id, verified: false }
    );
    for (const message of thread.replies ?? []) {
      await store.appendMessage(
        message.by === 'contact'
          ? {
              conversationId: conversation.id,
              authorType: 'contact',
              contactId: contact.id,
              body: message.body,
              verified: false,
            }
          : {
              conversationId: conversation.id,
              authorType: 'agent',
              agentId: rowan.id,
              body: message.body,
              internal: message.by === 'note',
            }
      );
    }
    if (thread.resolved) {
      await store.updateConversation(conversation.id, {
        status: 'resolved',
        resolvedAt: new Date(),
        waitingSince: null,
        assigneeId: rowan.id,
      });
    }
  }
}
