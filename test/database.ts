import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import pg from 'pg';

import { createAdapter } from '../src/db/adapter';
import {
  type Family,
  type KyselyAdapter,
  postgresAdapter,
  sqliteAdapter,
} from '../src/db/kysely';
import { testDatabaseUrl } from './database-url';

/** The database the integration suite runs on: `TEST_DB`, Postgres by default. */
export const testFamily = (process.env.TEST_DB || 'postgres') as Family;

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
