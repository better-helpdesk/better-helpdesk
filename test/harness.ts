import { sql } from 'drizzle-orm';
import pg from 'pg';

import {
  buildHelpdesk,
  type HelpdeskConfig,
  type HelpdeskEmail,
  type Identity,
  postgresAdapter,
  type StorageAdapter,
} from '../src';
import { testDatabaseUrl } from './database-url';

export const ADMIN_ORIGIN = 'https://app.test';
export const WWW_ORIGIN = 'https://www.test';
export const IDENTITY_SECRET = 'identity-secret';

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
    await support.store.db.execute(
      sql`UPDATE helpdesk.job SET run_at = now() WHERE run_at <> 'infinity'`
    );
    return support.runJobs();
  }

  return {
    support,
    pool,
    objects,
    emails,
    call,
    addUser,
    reset,
    runDueJobs,
    close: () => pool.end(),
  };
}

export type Harness = ReturnType<typeof createHarness>;
