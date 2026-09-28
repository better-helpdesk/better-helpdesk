#!/usr/bin/env node
// Applies the support schema migrations. One connection, closed on exit, so it
// can run next to `prisma migrate deploy` inside the environment's budget.
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const connectionString =
  process.env.HELPDESK_DATABASE_URL || process.env.APP_DATABASE_URL;
if (!connectionString) {
  console.error('HELPDESK_DATABASE_URL or APP_DATABASE_URL must be set');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  max: 1,
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

try {
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)),
    migrationsSchema: 'helpdesk',
    migrationsTable: '__migrations',
  });
  console.log('helpdesk: migrations applied');
} finally {
  await pool.end();
}
