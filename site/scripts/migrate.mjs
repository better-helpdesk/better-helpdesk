// Divio names the database DATABASE_URL; the package's CLI reads
// HELPDESK_DATABASE_URL. Run as a Divio release command.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { getMigrations } from 'better-auth/db/migration';
import pg from 'pg';

import { authSchema } from './auth-schema.mjs';

const migrate = fileURLToPath(
  new URL('../node_modules/better-helpdesk/bin/migrate.mjs', import.meta.url)
);
// The demo at /demo has a database of its own; it needs the helpdesk schema only.
for (const url of [
  process.env.HELPDESK_DATABASE_URL || process.env.DATABASE_URL,
  process.env.DEMO_DATABASE_URL,
]) {
  if (!url) continue;
  execFileSync(process.execPath, [migrate], {
    stdio: 'inherit',
    env: { ...process.env, HELPDESK_DATABASE_URL: url },
  });
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
const { runMigrations } = await getMigrations(authSchema(pool));
await runMigrations();
await pool.end();
console.log('auth: migrations applied');
