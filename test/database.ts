import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createPool } from 'mysql2';
import pg from 'pg';
import * as tarn from 'tarn';
import * as tedious from 'tedious';

import { memoryAdapter } from '../examples/adapters/database-memory';
import { createAdapter, type DatabaseAdapter } from '../src/db/adapter';
import {
  type Family,
  type KyselyAdapter,
  mssqlAdapter,
  mysqlAdapter,
  postgresAdapter,
  sqliteAdapter,
} from '../src/db/kysely';
import type { ModelName } from '../src/db/model';
import { testDatabaseUrl } from './database-url';

/** The database the integration suite runs on: `TEST_DB`, Postgres by default. */
export const testFamily = (process.env.TEST_DB || 'postgres') as
  | Family
  | 'memory';

const name = `helpdesk_test${process.env.TEST_DB_PREFIX ? `_${process.env.TEST_DB_PREFIX}` : ''}`;

export const testDatabaseName = () => name;

/** The MySQL server in `TEST_MYSQL_URL` and the test database on it. */
export const mysqlUrls = () => {
  const server = new URL(
    process.env.TEST_MYSQL_URL ?? 'mysql://root@localhost:3306/'
  );
  const database = new URL(server);
  database.pathname = `/${name}`;
  return { server: server.toString(), database: database.toString(), name };
};

/** A SQL Server adapter on `database` of the server in `TEST_MSSQL_URL`. */
export function mssqlTestAdapter(database: string) {
  const url = new URL(
    process.env.TEST_MSSQL_URL ?? 'mssql://sa@localhost:1433/'
  );
  return mssqlAdapter({
    tarn: { ...tarn, options: { min: 0, max: 4 } },
    tedious: {
      ...tedious,
      connectionFactory: () =>
        new tedious.Connection({
          server: url.hostname,
          authentication: {
            type: 'default',
            options: {
              userName: decodeURIComponent(url.username),
              password: decodeURIComponent(url.password),
            },
          },
          options: {
            port: Number(url.port) || 1433,
            database,
            trustServerCertificate: true,
          },
        }),
    },
  });
}

/** Where the SQLite run keeps its file. */
export const sqlitePath = () =>
  join(
    tmpdir(),
    `helpdesk_test${process.env.TEST_DB_PREFIX ? `_${process.env.TEST_DB_PREFIX}` : ''}.sqlite`
  );

function open(): {
  adapter: KyselyAdapter;
  pool?: pg.Pool;
  close: () => Promise<void>;
} {
  if (testFamily === 'mssql') {
    const adapter = mssqlTestAdapter(name);
    return { adapter, close: () => adapter.kysely.destroy() };
  }
  if (testFamily === 'mysql') {
    const pool = createPool({
      uri: mysqlUrls().database,
      timezone: 'Z',
      connectionLimit: 4,
    });
    const adapter = mysqlAdapter({ pool });
    return { adapter, close: () => adapter.kysely.destroy() };
  }
  if (testFamily === 'sqlite') {
    const database = new DatabaseSync(sqlitePath());
    const adapter = sqliteAdapter({ database });
    return { adapter, close: () => adapter.kysely.destroy() };
  }
  const pool = new pg.Pool({ connectionString: testDatabaseUrl(), max: 4 });
  return { adapter: postgresAdapter({ pool }), pool, close: () => pool.end() };
}

/**
 * The adapter the integration suite runs on, and how to let go of it. With
 * `TEST_PORTABLE` set, its capabilities are left out, so every query takes
 * the fallback a custom adapter gets.
 */
// One store for every harness of the run, as a database would be.
const memory = createAdapter(memoryAdapter());

export function testAdapter() {
  if (testFamily === 'memory') {
    return {
      adapter: memory,
      builtIn: undefined,
      pool: undefined,
      close: async () => {},
    };
  }
  const { adapter, pool, close } = open();
  return {
    adapter: process.env.TEST_PORTABLE
      ? createAdapter({ ...adapter.raw, capabilities: undefined })
      : adapter,
    /** The built-in adapter itself, which migrations take. */
    builtIn: adapter,
    /** Set on Postgres, for the tests that watch its locks. */
    pool,
    close,
  };
}

// Children first, so no foreign key holds a delete up.
const tables: ModelName[] = [
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

/** Empties every table but the counter. */
export async function emptyTables(adapter: DatabaseAdapter) {
  // References between the tables go first; SQL Server has no `on delete` to clear them.
  await adapter.updateMany('agent', undefined, { viewingId: null });
  await adapter.updateMany('conversation', undefined, { mergedIntoId: null });
  for (const table of tables) await adapter.deleteMany(table, undefined);
}
