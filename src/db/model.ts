/**
 * The tables Better Helpdesk keeps, once, for every database. Built-in
 * adapters create them through their migrations; a custom adapter reads this
 * to create its own. Fields are camelCase; columns are their snake_case.
 */

export type FieldKind =
  | 'uuid'
  /** Short text that may be indexed or compared exactly. */
  | 'string'
  /** Long text. */
  | 'text'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'json'
  /** An exact decimal, read and written as a string. */
  | 'decimal';

export type FieldDefault = 'uuid' | 'now' | string | number | boolean | object;

export type Field<T = unknown, Optional extends boolean = boolean> = {
  readonly kind: FieldKind;
  readonly nullable: boolean;
  readonly default?: FieldDefault;
  readonly references?: {
    model: string;
    onDelete: 'cascade' | 'set null';
  };
  /** Type-only: the value in a row, and whether an insert may leave it out. */
  readonly $type?: T;
  readonly $optional?: Optional;
};

type Builder<T, O extends boolean> = Field<T, O> & {
  orNull(): Builder<T | null, true>;
  withDefault(value: T | 'now' | 'uuid'): Builder<T, true>;
  ref(model: string, onDelete: 'cascade' | 'set null'): Builder<T, O>;
};

function field<T>(kind: FieldKind): Builder<T, false> {
  // biome-ignore lint/suspicious/noExplicitAny: the type parameters exist only on the result
  const make = (spec: Field): Builder<any, any> => ({
    ...spec,
    orNull: () => make({ ...spec, nullable: true }),
    withDefault: value => make({ ...spec, default: value as FieldDefault }),
    ref: (model, onDelete) =>
      make({ ...spec, references: { model, onDelete } }),
  });
  return make({ kind, nullable: false }) as unknown as Builder<T, false>;
}

const f = {
  id: () => field<string>('uuid').withDefault('uuid'),
  uuid: () => field<string>('uuid'),
  string: <T extends string = string>() => field<T>('string'),
  text: () => field<string>('text'),
  integer: () => field<number>('integer'),
  boolean: () => field<boolean>('boolean'),
  date: () => field<Date>('date'),
  json: <T>() => field<T>('json'),
  decimal: () => field<string>('decimal'),
  createdAt: () => field<Date>('date').withDefault('now'),
};

export type Table = {
  fields: Record<string, Field>;
  primaryKey: string[];
  /** Unique keys; `where` names a boolean field the key holds for only when true. */
  unique?: { fields: string[]; where?: string }[];
};

const table = <F extends Record<string, Field>>(
  fields: F,
  rest: { primaryKey?: (keyof F & string)[]; unique?: Table['unique'] } = {}
) => ({ fields, primaryKey: rest.primaryKey ?? ['id'], unique: rest.unique });

export type CustomValues = Record<string, string | number | null>;
export type IdentityChannel = 'host' | 'email' | 'visitor' | 'github';
export type AuthorType = 'contact' | 'agent' | 'system';
export type ActivityKind = 'note' | 'call' | 'meeting' | 'event';

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

const tag = <K extends string>(owner: K, model: string) =>
  table(
    {
      [owner]: f.uuid().ref(model, 'cascade'),
      tag: f.string(),
      /** Tags keep the order they were added in. */
      position: f.integer(),
    } as { [P in K | 'tag']: Builder<string, false> } & {
      position: Builder<number, false>;
    },
    { primaryKey: [owner, 'tag'] }
  );

export const helpdeskModel = {
  company: table(
    {
      id: f.id(),
      name: f.text(),
      externalOrgId: f.string().orNull(),
      domain: f.string().orNull(),
      leadStage: f.string().orNull(),
      custom: f.json<CustomValues>().withDefault({}),
      createdAt: f.createdAt(),
    },
    { unique: [{ fields: ['externalOrgId'] }] }
  ),
  contact: table({
    id: f.id(),
    name: f.text().orNull(),
    email: f.string().orNull(),
    companyId: f.uuid().orNull().ref('company', 'set null'),
    leadStage: f.string().orNull(),
    custom: f.json<CustomValues>().withDefault({}),
    locale: f.string().orNull(),
    /** Refused as a sender, and their conversations left out of the inbox. */
    blocked: f.boolean().withDefault(false),
    createdAt: f.createdAt(),
    lastSeenAt: f.date().orNull(),
  }),
  identity: table(
    {
      id: f.id(),
      contactId: f.uuid().ref('contact', 'cascade'),
      channel: f.string<IdentityChannel>(),
      externalId: f.string(),
      verified: f.boolean(),
      createdAt: f.createdAt(),
      /** A visitor token unused for too long stops opening its contact. */
      lastUsedAt: f.date().withDefault('now'),
    },
    {
      unique: [
        { fields: ['channel', 'externalId'], where: 'verified' },
        { fields: ['channel', 'externalId', 'contactId'] },
      ],
    }
  ),
  agent: table(
    {
      id: f.id(),
      externalUserId: f.string(),
      name: f.text().orNull(),
      email: f.string().orNull(),
      avatarUrl: f.text().orNull(),
      /** Set while away; the widget promises a reply after it instead of the usual one. */
      awayUntil: f.date().orNull(),
      lastSeenAt: f.date().withDefault('now'),
      /** Set once the host no longer counts them as an agent; they get no more mail. */
      deactivatedAt: f.date().orNull(),
      /** The conversation the agent last had open; others see them on it while `viewingAt` is recent. */
      viewingId: f.uuid().orNull().ref('conversation', 'set null'),
      viewingAt: f.date().orNull(),
    },
    { unique: [{ fields: ['externalUserId'] }] }
  ),
  conversation: table(
    {
      id: f.id(),
      number: f.integer(),
      inbox: f.string(),
      type: f.string(),
      status: f.string().withDefault('open'),
      priority: f.string().withDefault('normal'),
      /** What the customer called it; they only ever see this. */
      subject: f.text().orNull(),
      /** The team's name for it, from triage or a rename; agents see this first. */
      title: f.text().orNull(),
      contactId: f.uuid().ref('contact', 'cascade'),
      companyId: f.uuid().orNull().ref('company', 'cascade'),
      sharedWithCompany: f.boolean().withDefault(false),
      assigneeId: f.uuid().orNull().ref('agent', 'set null'),
      context: f.json<ConversationContext>().withDefault({}),
      aiSuggestion: f.json<AiSuggestion>().orNull(),
      waitingSince: f.date().orNull(),
      remindedAt: f.date().orNull(),
      snoozedUntil: f.date().orNull(),
      customerSeenAt: f.date().orNull(),
      /** `lastMessageAt` as of the last time any agent opened it; a newer message makes it unread. */
      agentSeenAt: f.date().orNull(),
      lastMessageAt: f.date().withDefault('now'),
      resolvedAt: f.date().orNull(),
      mergedIntoId: f.uuid().orNull().ref('conversation', 'set null'),
      rating: f.string<'good' | 'bad'>().orNull(),
      ratingComment: f.text().orNull(),
      ratedAt: f.date().orNull(),
      createdAt: f.createdAt(),
    },
    { unique: [{ fields: ['number'] }] }
  ),
  conversation_tag: tag('conversationId', 'conversation'),
  contact_tag: tag('contactId', 'contact'),
  company_tag: tag('companyId', 'company'),
  participant: table(
    {
      conversationId: f.uuid().ref('conversation', 'cascade'),
      contactId: f.uuid().ref('contact', 'cascade'),
    },
    { primaryKey: ['conversationId', 'contactId'] }
  ),
  message: table(
    {
      id: f.id(),
      conversationId: f.uuid().ref('conversation', 'cascade'),
      authorType: f.string<AuthorType>(),
      contactId: f.uuid().orNull().ref('contact', 'set null'),
      agentId: f.uuid().orNull().ref('agent', 'set null'),
      body: f.text(),
      internal: f.boolean().withDefault(false),
      /**
       * A customer message whose author proved who they are: a host user, or
       * mail their domain signed. Null on messages written before this was kept.
       */
      verified: f.boolean().orNull(),
      emailMessageId: f.string().orNull(),
      createdAt: f.createdAt(),
    },
    { unique: [{ fields: ['emailMessageId'] }] }
  ),
  conversation_event: table({
    id: f.id(),
    conversationId: f.uuid().ref('conversation', 'cascade'),
    agentId: f.uuid().orNull().ref('agent', 'set null'),
    kind: f.string(),
    data: f.json<Record<string, unknown>>().withDefault({}),
    createdAt: f.createdAt(),
  }),
  attachment: table({
    id: f.id(),
    conversationId: f.uuid().ref('conversation', 'cascade'),
    messageId: f.uuid().orNull().ref('message', 'cascade'),
    key: f.text(),
    filename: f.text(),
    contentType: f.string(),
    size: f.integer(),
    uploaded: f.boolean().withDefault(false),
    createdAt: f.createdAt(),
  }),
  canned_reply: table({
    id: f.id(),
    title: f.text(),
    body: f.text(),
    locale: f.string().orNull(),
    createdAt: f.createdAt(),
  }),
  /** Settings an agent changes in the admin, one JSON value per key. */
  setting: table(
    {
      key: f.string(),
      value: f.json<unknown>(),
      updatedAt: f.date().withDefault('now'),
    },
    { primaryKey: ['key'] }
  ),
  deal: table({
    id: f.id(),
    title: f.text(),
    companyId: f.uuid().orNull().ref('company', 'cascade'),
    // A deal is the company's; losing the person leaves it without a contact.
    contactId: f.uuid().orNull().ref('contact', 'set null'),
    stage: f.string(),
    stageChangedAt: f.date().withDefault('now'),
    value: f.decimal().orNull(),
    currency: f.string().withDefault('CHF'),
    expectedCloseAt: f.date().orNull(),
    ownerId: f.uuid().orNull().ref('agent', 'set null'),
    custom: f.json<CustomValues>().withDefault({}),
    createdAt: f.createdAt(),
  }),
  activity: table({
    id: f.id(),
    kind: f.string<ActivityKind>(),
    contactId: f.uuid().orNull().ref('contact', 'cascade'),
    companyId: f.uuid().orNull().ref('company', 'cascade'),
    dealId: f.uuid().orNull().ref('deal', 'cascade'),
    agentId: f.uuid().orNull().ref('agent', 'set null'),
    body: f.text().orNull(),
    event: f.string().orNull(),
    props: f.json<Record<string, unknown>>().orNull(),
    occurredAt: f.date().withDefault('now'),
  }),
  job: table({
    id: f.id(),
    kind: f.string(),
    payload: f.json<Record<string, unknown>>(),
    runAt: f.date().withDefault('now'),
    attempts: f.integer().withDefault(0),
    lockedUntil: f.date().orNull(),
    lastError: f.text().orNull(),
    createdAt: f.createdAt(),
  }),
  rate_limit: table(
    {
      key: f.string(),
      windowStart: f.date(),
      count: f.integer().withDefault(0),
    },
    { primaryKey: ['key', 'windowStart'] }
  ),
  /** Named counters, such as the next conversation reference. */
  counter: table(
    { name: f.string(), value: f.integer() },
    { primaryKey: ['name'] }
  ),
} satisfies Record<string, Table>;

export type HelpdeskModel = typeof helpdeskModel;
export type ModelName = keyof HelpdeskModel;

type Fields<M extends ModelName> = HelpdeskModel[M]['fields'];
type ValueOf<F> = F extends Field<infer T> ? T : never;

/** A row as the store reads it. */
export type Row<M extends ModelName> = {
  [K in keyof Fields<M>]: ValueOf<Fields<M>[K]>;
};

type OptionalKeys<M extends ModelName> = {
  [K in keyof Fields<M>]: Fields<M>[K] extends Field<unknown, true> ? K : never;
}[keyof Fields<M>];

/** A row as the store writes it: fields with a default or that may be null can be left out. */
export type Insert<M extends ModelName> = Omit<Row<M>, OptionalKeys<M>> &
  Partial<Pick<Row<M>, OptionalKeys<M>>>;

export const column = (field: string) =>
  field.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
