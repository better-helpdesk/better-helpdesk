// Divio names the database DATABASE_URL; the package's CLI reads
// HELPDESK_DATABASE_URL. Run as a Divio release command.
import { getMigrations } from 'better-auth/db/migration';
import pg from 'pg';

import { authSchema } from './auth-schema.mjs';

process.env.HELPDESK_DATABASE_URL ||= process.env.DATABASE_URL;
await import(
  new URL('../node_modules/better-helpdesk/bin/migrate.mjs', import.meta.url)
    .href
);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
const { runMigrations } = await getMigrations(authSchema(pool));
await runMigrations();
await pool.end();
console.log('auth: migrations applied');
