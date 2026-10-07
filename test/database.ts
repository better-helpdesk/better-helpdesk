import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createPool } from 'mysql2';
import pg from 'pg';

import { createAdapter } from '../src/db/adapter';
import {
  type Family,
  type KyselyAdapter,
  mysqlAdapter,
  postgresAdapter,
  sqliteAdapter,
} from '../src/db/kysely';
import { testDatabaseUrl } from './database-url';

/** The database the integration suite runs on: `TEST_DB`, Postgres by default. */
export const testFamily = (process.env.TEST_DB || 'postgres') as Family;

const name = `helpdesk_test${process.env.TEST_DB_PREFIX ? `_${process.env.TEST_DB_PREFIX}` : ''}`;

/** The MySQL server in `TEST_MYSQL_URL` and the test database on it. */
export const mysqlUrls = () => {
  const server = new URL(
    process.env.TEST_MYSQL_URL ?? 'mysql://root@localhost:3306/'
  );
  const database = new URL(server);
  database.pathname = `/${name}`;
  return { server: server.toString(), database: database.toString(), name };
};

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
export function testAdapter() {
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
