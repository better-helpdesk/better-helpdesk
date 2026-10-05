import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const helpdesk = pgSchema('helpdesk');

const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export type CustomValues = Record<string, string | number | null>;

export const referenceSeq = helpdesk.sequence('reference_seq', {
  startWith: 1000,
});

export const companies = helpdesk.table(
  'company',
  {
    id: id(),
    name: text('name').notNull(),
    externalOrgId: text('external_org_id'),
    domain: text('domain'),
    leadStage: text('lead_stage'),
    tags: text('tags').array().notNull().default(sql`'{}'`),
    custom: jsonb('custom').$type<CustomValues>().notNull().default({}),
    createdAt: createdAt(),
  },
  t => [
    uniqueIndex('company_external_org_id_key').on(t.externalOrgId),
    index('company_domain_idx').on(t.domain),
  ]
);

export const contacts = helpdesk.table(
  'contact',
  {
    id: id(),
    name: text('name'),
    email: text('email'),
    companyId: uuid('company_id').references(() => companies.id, {
      onDelete: 'set null',
    }),
    leadStage: text('lead_stage'),
    tags: text('tags').array().notNull().default(sql`'{}'`),
    custom: jsonb('custom').$type<CustomValues>().notNull().default({}),
    locale: text('locale'),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at'),
  },
  t => [
    index('contact_company_idx').on(t.companyId),
    index('contact_email_idx').on(t.email),
  ]
);

export type IdentityChannel = 'host' | 'email' | 'visitor' | 'github';

export const identities = helpdesk.table(
  'identity',
  {
    id: id(),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    channel: text('channel').$type<IdentityChannel>().notNull(),
    externalId: text('external_id').notNull(),
    verified: boolean('verified').notNull(),
    createdAt: createdAt(),
    /** A visitor token unused for too long stops opening its contact. */
    lastUsedAt: ts('last_used_at').notNull().defaultNow(),
  },
  t => [
    uniqueIndex('identity_verified_key')
      .on(t.channel, t.externalId)
      .where(sql`${t.verified}`),
    // Channel first: anonymous widget polls look an identity up by channel
    // and external id alone.
    uniqueIndex('identity_contact_key').on(
      t.channel,
      t.externalId,
      t.contactId
    ),
    index('identity_contact_idx').on(t.contactId),
  ]
);

export const agents = helpdesk.table(
  'agent',
  {
    id: id(),
    externalUserId: text('external_user_id').notNull(),
    name: text('name'),
    email: text('email'),
    avatarUrl: text('avatar_url'),
    /** Set while away; the widget promises a reply after it instead of the usual one. */
    awayUntil: ts('away_until'),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    /** Set once the host no longer counts them as an agent; they get no more mail. */
    deactivatedAt: ts('deactivated_at'),
    /** The conversation the agent last had open; others see them on it while `viewingAt` is recent. */
    viewingId: uuid('viewing_id').references(
      (): AnyPgColumn => conversations.id,
      { onDelete: 'set null' }
    ),
    viewingAt: ts('viewing_at'),
  },
  t => [uniqueIndex('agent_external_user_id_key').on(t.externalUserId)]
);

export type ConversationContext = {
  url?: string;
  title?: string;
  userAgent?: string;
  viewport?: string;
  locale?: string;
  appVersion?: string;
  host?: Record<string, string>;
  errors?: string[];
  landingPage?: string;
  referrer?: string;
  utm?: Record<string, string>;
};

export type AiSuggestion = {
  type?: string;
  priority?: string;
  title?: string;
  summary?: string;
  duplicates?: { conversationId: string; reference: string; reason: string }[];
  acceptedAt?: string;
};

export const conversations = helpdesk.table(
  'conversation',
  {
    id: id(),
    number: integer('number')
      .notNull()
      .default(sql`nextval('helpdesk.reference_seq')`),
    inbox: text('inbox').notNull(),
    type: text('type').notNull(),
    status: text('status').notNull().default('open'),
    priority: text('priority').notNull().default('normal'),
    /** What the customer called it; they only ever see this. */
    subject: text('subject'),
    /** The team's name for it, from triage or a rename; agents see this first. */
    title: text('title'),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').references(() => companies.id, {
      onDelete: 'cascade',
    }),
    sharedWithCompany: boolean('shared_with_company').notNull().default(false),
    assigneeId: uuid('assignee_id').references(() => agents.id, {
      onDelete: 'set null',
    }),
    context: jsonb('context')
      .$type<ConversationContext>()
      .notNull()
      .default({}),
    aiSuggestion: jsonb('ai_suggestion').$type<AiSuggestion>(),
    tags: text('tags').array().notNull().default(sql`'{}'`),
    waitingSince: ts('waiting_since'),
    remindedAt: ts('reminded_at'),
    snoozedUntil: ts('snoozed_until'),
    customerSeenAt: ts('customer_seen_at'),
    /** `last_message_at` as of the last time any agent opened it; a newer message makes it unread. */
    agentSeenAt: ts('agent_seen_at'),
    lastMessageAt: ts('last_message_at').notNull().defaultNow(),
    resolvedAt: ts('resolved_at'),
    mergedIntoId: uuid('merged_into_id').references(
      (): AnyPgColumn => conversations.id,
      { onDelete: 'set null' }
    ),
    createdAt: createdAt(),
    search: tsvector('search').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(subject, ''))`
    ),
  },
  t => [
    uniqueIndex('conversation_number_key').on(t.number),
    index('conversation_inbox_status_idx').on(t.inbox, t.status),
    index('conversation_contact_idx').on(t.contactId, t.createdAt),
    index('conversation_company_idx').on(t.companyId),
    index('conversation_waiting_idx').on(t.waitingSince),
    index('conversation_search_idx').using('gin', t.search),
    index('conversation_tags_idx').using('gin', t.tags),
    index('conversation_snoozed_idx')
      .on(t.snoozedUntil)
      .where(sql`${t.snoozedUntil} IS NOT NULL`),
  ]
);

export const participants = helpdesk.table(
  'participant',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
  },
  t => [
    primaryKey({ columns: [t.conversationId, t.contactId] }),
    index('participant_contact_idx').on(t.contactId),
  ]
);

export type AuthorType = 'contact' | 'agent' | 'system';

export const messages = helpdesk.table(
  'message',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    authorType: text('author_type').$type<AuthorType>().notNull(),
    contactId: uuid('contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    agentId: uuid('agent_id').references(() => agents.id, {
      onDelete: 'set null',
    }),
    body: text('body').notNull(),
    internal: boolean('internal').notNull().default(false),
    /**
     * A customer message whose author proved who they are: a host user, or
     * mail their domain signed. Null on messages written before this was kept.
     */
    verified: boolean('verified'),
    emailMessageId: text('email_message_id'),
    createdAt: createdAt(),
    search: tsvector('search').generatedAlwaysAs(
      sql`to_tsvector('simple', body)`
    ),
  },
  t => [
    index('message_conversation_idx').on(t.conversationId, t.createdAt),
    index('message_contact_idx').on(t.contactId),
    uniqueIndex('message_email_message_id_key').on(t.emailMessageId),
    index('message_search_idx').using('gin', t.search),
  ]
);

export const conversationEvents = helpdesk.table(
  'conversation_event',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').references(() => agents.id, {
      onDelete: 'set null',
    }),
    kind: text('kind').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  t => [
    index('conversation_event_conversation_idx').on(
      t.conversationId,
      t.createdAt
    ),
  ]
);

export const attachments = helpdesk.table(
  'attachment',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => messages.id, {
      onDelete: 'cascade',
    }),
    key: text('key').notNull(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    uploaded: boolean('uploaded').notNull().default(false),
    createdAt: createdAt(),
  },
  t => [index('attachment_conversation_idx').on(t.conversationId)]
);

export const cannedReplies = helpdesk.table('canned_reply', {
  id: id(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  locale: text('locale'),
  createdAt: createdAt(),
});

/** Settings an agent changes in the admin, one JSON value per key. */
export const settings = helpdesk.table('setting', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const deals = helpdesk.table(
  'deal',
  {
    id: id(),
    title: text('title').notNull(),
    companyId: uuid('company_id').references(() => companies.id, {
      onDelete: 'cascade',
    }),
    // A deal is the company's; losing the person leaves it without a contact.
    contactId: uuid('contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    stage: text('stage').notNull(),
    stageChangedAt: ts('stage_changed_at').notNull().defaultNow(),
    value: numeric('value', { precision: 14, scale: 2 }),
    currency: text('currency').notNull().default('CHF'),
    expectedCloseAt: ts('expected_close_at'),
    ownerId: uuid('owner_id').references(() => agents.id, {
      onDelete: 'set null',
    }),
    custom: jsonb('custom').$type<CustomValues>().notNull().default({}),
    createdAt: createdAt(),
  },
  t => [
    index('deal_stage_idx').on(t.stage),
    index('deal_company_idx').on(t.companyId),
    index('deal_contact_idx').on(t.contactId),
  ]
);

export type ActivityKind = 'note' | 'call' | 'meeting' | 'event';

export const activities = helpdesk.table(
  'activity',
  {
    id: id(),
    kind: text('kind').$type<ActivityKind>().notNull(),
    contactId: uuid('contact_id').references(() => contacts.id, {
      onDelete: 'cascade',
    }),
    companyId: uuid('company_id').references(() => companies.id, {
      onDelete: 'cascade',
    }),
    dealId: uuid('deal_id').references(() => deals.id, {
      onDelete: 'cascade',
    }),
    agentId: uuid('agent_id').references(() => agents.id, {
      onDelete: 'set null',
    }),
    body: text('body'),
    event: text('event'),
    props: jsonb('props').$type<Record<string, unknown>>(),
    occurredAt: ts('occurred_at').notNull().defaultNow(),
  },
  t => [
    index('activity_contact_idx').on(t.contactId, t.occurredAt),
    index('activity_company_idx').on(t.companyId, t.occurredAt),
    index('activity_deal_idx').on(t.dealId, t.occurredAt),
  ]
);

export const jobs = helpdesk.table(
  'job',
  {
    id: id(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    runAt: ts('run_at').notNull().defaultNow(),
    attempts: integer('attempts').notNull().default(0),
    lockedUntil: ts('locked_until'),
    lastError: text('last_error'),
    createdAt: createdAt(),
  },
  t => [index('job_run_at_idx').on(t.runAt)]
);

export const rateLimits = helpdesk.table(
  'rate_limit',
  {
    key: text('key').notNull(),
    windowStart: ts('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  t => [primaryKey({ columns: [t.key, t.windowStart] })]
);
