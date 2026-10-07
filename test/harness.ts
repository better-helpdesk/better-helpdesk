import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  type SQL,
  sql,
} from 'drizzle-orm';
import pg from 'pg';

import {
  buildHelpdesk,
  type HelpdeskConfig,
  type HelpdeskEmail,
  type Identity,
  postgresAdapter,
  type StorageAdapter,
} from '../src';
import { schema } from '../src/db/store';
import { testDatabaseUrl } from './database-url';

const tables = {
  activity: schema.activities,
  agent: schema.agents,
  attachment: schema.attachments,
  canned_reply: schema.cannedReplies,
  company: schema.companies,
  contact: schema.contacts,
  conversation: schema.conversations,
  conversation_event: schema.conversationEvents,
  deal: schema.deals,
  identity: schema.identities,
  job: schema.jobs,
  message: schema.messages,
  participant: schema.participants,
  rate_limit: schema.rateLimits,
  setting: schema.settings,
};

export type Model = keyof typeof tables;
export type Row<M extends Model> = (typeof tables)[M]['$inferSelect'];
/** Equality per field; `null` matches NULL and an array matches any of its values. */
export type Where<M extends Model> = {
  [K in keyof Row<M>]?: Row<M>[K] | null | NonNullable<Row<M>[K]>[];
};
export type OrderBy<M extends Model> = {
  [K in keyof Row<M>]?: 'asc' | 'desc';
};

/** A time `ms` milliseconds before now, from the app's clock as the store uses it. */
export const ago = (ms: number) => new Date(Date.now() - ms);
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const ADMIN_ORIGIN = 'https://app.test';
export const WWW_ORIGIN = 'https://www.test';
export const IDENTITY_SECRET = 'identity-secret-for-the-test-harness';

export function createHarness(overrides: Partial<HelpdeskConfig> = {}) {
  const pool = new pg.Pool({ connectionString: testDatabaseUrl(), max: 4 });
  const objects = new Map<string, Uint8Array>();
  const emails: HelpdeskEmail[] = [];
  const users = new Map<string, Identity>();

  const storage: StorageAdapter = {
    async presignUpload(key) {
      return { url: `https://s3.test/${key}`, fields: { key } };
    },
    async presignDownload(key) {
      return `https://s3.test/${key}?signed`;
    },
    async put(key, body) {
      objects.set(key, body);
    },
    async exists(key) {
      return objects.has(key);
    },
    async delete(key) {
      objects.delete(key);
    },
  };

  const support = buildHelpdesk({
    db: postgresAdapter({ pool }),
    referencePrefix: 'DG',
    adminUrl: `${ADMIN_ORIGIN}/settings/admin/support/`,
    inboxes: {
      support: { reminderAfterHours: 1 },
      sales: { public: true, allowedOrigins: [WWW_ORIGIN] },
    },
    identify: async request =>
      users.get(request.headers.get('x-test-user') ?? '') ?? null,
    storage,
    email: {
      async send(message) {
        emails.push(message);
      },
    },
    jobsSecret: 'jobs-secret',
    identityTokenSecret: IDENTITY_SECRET,
    replyToAddress: ref => `support+${ref}@devguard.test`,
    ...overrides,
  });

  async function call(
    method: string,
    path: string,
    {
      user,
      body,
      headers = {},
    }: { user?: string; body?: unknown; headers?: Record<string, string> } = {}
  ) {
    const response = await support.handler(
      new Request(`${ADMIN_ORIGIN}/api/helpdesk/${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(user ? { 'x-test-user': user } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    );
    const text = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      // biome-ignore lint/suspicious/noExplicitAny: test responses are asserted field by field
      data: (text ? JSON.parse(text) : null) as any,
    };
  }

  function addUser(
    key: string,
    {
      orgs = [],
      isAgent = false,
      email = `${key}@example.test`,
      emailVerified = true,
    }: {
      orgs?: Identity['orgs'];
      isAgent?: boolean;
      email?: string;
      emailVerified?: boolean;
    } = {}
  ) {
    users.set(key, {
      user: {
        id: `user-${key}`,
        name: key,
        email,
        emailVerified,
        locale: 'en',
      },
      orgs,
      isAgent,
    });
  }

  async function reset() {
    await support.store.db.execute(sql`
      TRUNCATE helpdesk.activity, helpdesk.agent, helpdesk.attachment, helpdesk.canned_reply,
        helpdesk.company, helpdesk.contact, helpdesk.conversation, helpdesk.deal,
        helpdesk.identity, helpdesk.job, helpdesk.message,
        helpdesk.participant, helpdesk.rate_limit, helpdesk.setting CASCADE`);
    objects.clear();
    emails.length = 0;
    users.clear();
  }

  async function runDueJobs() {
    await support.store.db
      .update(schema.jobs)
      .set({ runAt: new Date() })
      .where(sql`${schema.jobs.runAt} < '9999-01-01'`);
    return support.runJobs();
  }

  // The tests reach the database only through these, so the same suite runs
  // on every adapter.
  function condition<M extends Model>(model: M, where: Where<M> = {}) {
    const table = tables[model] as unknown as Record<string, never>;
    const parts: SQL[] = [];
    for (const [key, value] of Object.entries(where)) {
      const column = table[key];
      if (!column) throw new Error(`No field ${key} on ${model}`);
      parts.push(
        value === null
          ? isNull(column)
          : Array.isArray(value)
            ? inArray(column, value)
            : eq(column, value)
      );
    }
    return and(...parts);
  }

  async function find<M extends Model>(
    model: M,
    where: Where<M> = {},
    { orderBy = {}, limit }: { orderBy?: OrderBy<M>; limit?: number } = {}
  ): Promise<Row<M>[]> {
    const table = tables[model] as unknown as Record<string, never>;
    const query = support.store.db
      .select()
      .from(tables[model] as typeof schema.jobs)
      .where(condition(model, where))
      .orderBy(
        ...Object.entries(orderBy).map(([key, dir]) =>
          dir === 'desc' ? desc(table[key] as never) : asc(table[key] as never)
        )
      );
    return (await (limit ? query.limit(limit) : query)) as Row<M>[];
  }

  async function findOne<M extends Model>(model: M, where: Where<M> = {}) {
    const [row] = await find(model, where, { limit: 1 });
    return row ?? null;
  }

  async function count<M extends Model>(model: M, where: Where<M> = {}) {
    return (await find(model, where)).length;
  }

  async function update<M extends Model>(
    model: M,
    where: Where<M>,
    patch: Partial<Row<M>>
  ) {
    await support.store.db
      .update(tables[model])
      .set(patch as never)
      .where(condition(model, where));
  }

  async function insert<M extends Model>(
    model: M,
    values: Partial<Row<M>>
  ): Promise<Row<M>> {
    const [row] = await support.store.db
      .insert(tables[model])
      .values(values as never)
      .returning();
    return row as Row<M>;
  }

  async function remove<M extends Model>(model: M, where: Where<M>) {
    await support.store.db.delete(tables[model]).where(condition(model, where));
  }

  return {
    support,
    pool,
    storage,
    objects,
    emails,
    call,
    addUser,
    reset,
    runDueJobs,
    find,
    findOne,
    count,
    update,
    insert,
    remove,
    close: () => pool.end(),
  };
}

export type Harness = ReturnType<typeof createHarness>;
