import pg from 'pg';

import { createAdapter } from '../src/db/adapter';
import { postgresAdapter } from '../src/db/kysely';
import { testDatabaseUrl } from './database-url';

/**
 * The adapter the integration suite runs on, and how to let go of it. With
 * `TEST_PORTABLE` set, its capabilities are left out, so every query takes
 * the fallback a custom adapter gets.
 */
export function testAdapter() {
  const pool = new pg.Pool({ connectionString: testDatabaseUrl(), max: 4 });
  const adapter = postgresAdapter({ pool });
  return {
    adapter: process.env.TEST_PORTABLE
      ? createAdapter({ ...adapter.raw, capabilities: undefined })
      : adapter,
    /** The built-in adapter itself, which migrations take. */
    builtIn: adapter,
    /** Set on Postgres, for the tests that watch its locks. */
    pool: pool as pg.Pool | undefined,
    close: () => pool.end(),
  };
}
