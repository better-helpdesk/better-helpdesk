/**
 * Fills the inbox so the demo has something to show before anyone writes in.
 * Run with `pnpm --filter better-helpdesk-demo seed`. Every person here is
 * invented and lives on a `.test` domain.
 */
import { helpdesk, pool } from '../lib/helpdesk';

type ConversationContext = NonNullable<
  Parameters<typeof helpdesk.store.createConversation>[0]['context']
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
  /** Later messages, in order. */
  replies?: { by: 'agent' | 'note' | 'contact'; body: string }[];
  resolved?: boolean;
  /** The customer's rating of a resolved conversation. */
  rating?: 'good' | 'bad';
  ratingComment?: string;
  assignee?: 'rowan' | 'kit';
  /** Waiting on the customer after the team's last reply. */
  pending?: boolean;
  tags?: string[];
};

const browser = (
  url: string,
  extra: Partial<ConversationContext> = {}
): ConversationContext => ({
  url: `http://localhost:3000${url}`,
  title: 'Harbor',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15',
  viewport: '1512×862',
  locale: 'en',
  appVersion: 'harbor@4.12.0',
  ...extra,
});

const THREADS: Thread[] = [
  {
    from: {
      name: 'Tomás Reyes',
      email: 'tomas@brightline.test',
      org: 'brightline',
    },
    inbox: 'support',
    type: 'bug',
    priority: 'p2',
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
    priority: 'p1',
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
    priority: 'p3',
    subject: 'Dark mode for the driver app',
    body: 'Our drivers work night shifts. A dark mode in the driver app would be easier on their eyes.',
    context: browser('/drivers'),
    tags: ['driver-app'],
  },
  {
    from: { name: 'Jonas Weber', email: 'jonas@nordkai.test' },
    inbox: 'support',
    type: 'question',
    subject: 'Invoice address change',
    body: 'We moved offices. Where do I change the address on our invoices?',
    context: browser('/billing'),
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
      landingPage: 'http://localhost:3000/pricing',
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
    from: { name: 'Daniel Okafor', email: 'daniel@greenquay.test' },
    inbox: 'sales',
    type: 'lead',
    subject: 'Security questionnaire',
    body: 'Before we can sign we need your answers to our security questionnaire. Who should I send it to?',
    segment: '500-5000',
    context: browser('/security'),
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
  {
    from: { name: 'Elias Brunner', email: 'elias@bergfracht.test' },
    inbox: 'support',
    type: 'question',
    subject: 'API rate limits',
    body: 'What are the rate limits on the shipments API? We plan to sync every five minutes.',
    context: browser('/developers'),
  },
  {
    from: { name: 'Clara Moreau', email: 'clara@quaidelest.test' },
    inbox: 'support',
    type: 'question',
    subject: 'Change the language of customer emails',
    body: 'Our customers are in France. Can the shipment emails go out in French?',
    context: browser('/settings/notifications', { locale: 'fr' }),
    replies: [
      {
        by: 'agent',
        body: 'Yes: Settings → Notifications → Language. Each customer can also have their own.',
      },
      { by: 'contact', body: 'Perfect, that worked.' },
    ],
    resolved: true,
    rating: 'good',
    ratingComment: 'Quick and clear.',
    assignee: 'rowan',
    tags: ['emails'],
  },
  {
    from: { name: 'Pieter de Vries', email: 'pieter@grachtcargo.test' },
    inbox: 'support',
    type: 'bug',
    subject: 'CSV import skips the last row',
    body: 'When I import shipments from a CSV, the last row never shows up.',
    context: browser('/shipments/import'),
    replies: [
      {
        by: 'agent',
        body: 'Thanks for the file. The importer needs a line break after the last row; we will fix that, and adding one works today.',
      },
    ],
    resolved: true,
    rating: 'bad',
    ratingComment: 'A workaround is not a fix.',
    assignee: 'kit',
    tags: ['import'],
  },
  {
    from: { name: 'Yusuf Demir', email: 'yusuf@bosporuslines.test' },
    inbox: 'support',
    type: 'question',
    subject: 'Who can see our rates?',
    body: 'Can our customers see the rates we pay carriers, or only their own price?',
    context: browser('/settings/roles'),
    replies: [
      {
        by: 'agent',
        body: 'Only their own price. Carrier rates stay with your team unless you give a role the Rates permission.',
      },
    ],
    resolved: true,
    rating: 'good',
    assignee: 'kit',
  },
  {
    from: { name: 'Marta Kowalska', email: 'marta@wislafreight.test' },
    inbox: 'support',
    type: 'bug',
    subject: 'Duplicate notifications for one delivery',
    body: 'Each delivery sends two "delivered" emails to our customer.',
    context: browser('/shipments/HB-91022'),
    replies: [
      {
        by: 'agent',
        body: 'Found it: two webhooks pointed at the same event. I removed the older one, so it should be one email from now on.',
      },
    ],
    resolved: true,
    rating: 'bad',
    ratingComment: 'Took three days.',
    assignee: 'rowan',
    tags: ['emails'],
  },
  {
    from: {
      name: 'Felix Baumann',
      email: 'felix@brightline.test',
      org: 'brightline',
    },
    inbox: 'support',
    type: 'question',
    subject: 'Driver app login on a shared tablet',
    body: 'Several drivers share one tablet. Do they each need their own login?',
    context: browser('/drivers/devices'),
    replies: [
      {
        by: 'agent',
        body: 'They can share one device: turn on "Shared device" and each driver signs in with a PIN. Which tablet model do you use?',
      },
    ],
    pending: true,
    assignee: 'rowan',
    tags: ['driver-app'],
  },
  {
    from: { name: 'Noor Haddad', email: 'noor@cedarroute.test' },
    inbox: 'support',
    type: 'question',
    subject: 'Archive old shipments',
    body: 'Can we hide shipments older than a year from the board?',
    context: browser('/shipments?view=board'),
    assignee: 'kit',
  },
];

const [seq] = (
  await pool.query<{ is_called: boolean }>(
    'select is_called from helpdesk.reference_seq'
  )
).rows;
if (seq?.is_called) {
  console.log('The inbox already has conversations; nothing seeded.');
} else {
  const { store } = helpdesk;
  const rowan = await store.touchAgent({
    externalUserId: 'demo-agent',
    name: 'Rowan Vester',
    email: 'rowan@harbor.test',
  });
  // A teammate, so assignments and the statistics by assignee have two people.
  const kit = await store.touchAgent({
    externalUserId: 'demo-agent-kit',
    name: 'Kit Achterberg',
    email: 'kit@harbor.test',
  });
  const agents = { rowan, kit };
  const contacts = new Map<string, string>();
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
    contacts.set(thread.from.email, contact.id);
    const { conversation } = await store.createConversation(
      {
        inbox: thread.inbox,
        type: thread.type,
        priority: thread.priority ?? (thread.inbox === 'sales' ? 'p2' : 'p3'),
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
    const assigneeId = agents[thread.assignee ?? 'rowan'].id;
    if (thread.resolved) {
      await store.updateConversation(conversation.id, {
        status: 'resolved',
        resolvedAt: new Date(),
        waitingSince: null,
        assigneeId,
      });
      if (thread.rating)
        await store.rateConversation(conversation.id, {
          rating: thread.rating,
          ratingComment: thread.ratingComment ?? null,
          ratedAt: new Date(),
        });
    } else if (thread.pending) {
      await store.updateConversation(conversation.id, {
        status: 'pending',
        waitingSince: null,
        assigneeId,
      });
    } else if (thread.assignee) {
      await store.updateConversation(conversation.id, { assigneeId });
    }
  }

  const deal = (
    title: string,
    stage: string,
    value: string,
    extra: { companyId?: string; contactEmail?: string; ownerId: string }
  ) =>
    store.createDeal({
      title,
      stage,
      value,
      currency: 'CHF',
      companyId: extra.companyId ?? null,
      contactId: extra.contactEmail
        ? (contacts.get(extra.contactEmail) ?? null)
        : null,
      ownerId: extra.ownerId,
    });
  await deal('Brightline: second warehouse', 'proposal', '18000', {
    companyId: brightline.id,
    contactEmail: 'ingrid@brightline.test',
    ownerId: rowan.id,
  });
  await deal('Via Lattea: 8,000 shipments a month', 'qualified', '96000', {
    contactEmail: 'mateo@vialattea.test',
    ownerId: kit.id,
  });
  await deal('Petit Port: starter plan', 'new', '2400', {
    contactEmail: 'sophie@petitport.test',
    ownerId: rowan.id,
  });
  console.log(`Seeded ${THREADS.length} conversations.`);
}
await pool.end();
