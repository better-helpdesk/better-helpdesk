import {
  buildHelpdesk,
  type HelpdeskConfig,
  type HelpdeskEmail,
  type Identity,
  type StorageAdapter,
} from '../src';
import type { Where as AdapterWhere } from '../src/db/adapter';
import type { ModelName, Row as ModelRow } from '../src/db/model';
import { testAdapter } from './database';

export type Model = ModelName;
export type Row<M extends Model> = ModelRow<M>;
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
  const { adapter, pool, close } = testAdapter();
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
    db: adapter,
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

  // Children first, so no foreign key holds a delete up.
  const tables: Model[] = [
    'conversation_tag',
    'contact_tag',
    'company_tag',
    'attachment',
    'conversation_event',
    'participant',
    'message',
    'activity',
    'deal',
    'identity',
    'conversation',
    'agent',
    'contact',
    'company',
    'job',
    'rate_limit',
    'setting',
    'canned_reply',
  ];

  async function reset() {
    for (const table of tables) await adapter.deleteMany(table, undefined);
    objects.clear();
    emails.length = 0;
    users.clear();
  }

  async function runDueJobs() {
    await adapter.updateMany(
      'job',
      { field: 'runAt', op: 'lt', value: new Date('9999-01-01') },
      { runAt: new Date() }
    );
    return support.runJobs();
  }

  // The tests reach the database only through these, so the same suite runs
  // on every adapter.
  function condition<M extends Model>(where: Where<M> = {}): AdapterWhere {
    return {
      and: Object.entries(where).map(([field, value]) =>
        Array.isArray(value)
          ? { field, op: 'in' as const, value }
          : { field, value }
      ),
    };
  }

  async function find<M extends Model>(
    model: M,
    where: Where<M> = {},
    { orderBy = {}, limit }: { orderBy?: OrderBy<M>; limit?: number } = {}
  ): Promise<Row<M>[]> {
    return adapter.findMany<Row<M>>(model, {
      where: condition(where),
      orderBy: Object.entries(orderBy).map(([field, direction]) => ({
        field,
        direction: direction as 'asc' | 'desc',
      })),
      limit,
    });
  }

  async function findOne<M extends Model>(model: M, where: Where<M> = {}) {
    const [row] = await find(model, where, { limit: 1 });
    return row ?? null;
  }

  async function count<M extends Model>(model: M, where: Where<M> = {}) {
    return adapter.count(model, condition(where));
  }

  async function update<M extends Model>(
    model: M,
    where: Where<M>,
    patch: Partial<Row<M>>
  ) {
    await adapter.updateMany(model, condition(where), patch);
  }

  async function insert<M extends Model>(
    model: M,
    values: Partial<Row<M>>
  ): Promise<Row<M>> {
    return adapter.create<Row<M>>(model, values);
  }

  async function remove<M extends Model>(model: M, where: Where<M>) {
    await adapter.deleteMany(model, condition(where));
  }

  return {
    support,
    adapter,
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
    close,
  };
}

export type Harness = ReturnType<typeof createHarness>;
