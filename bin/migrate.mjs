#!/usr/bin/env node
// Applies the support schema migrations. One connection, closed on exit, so it
// can run next to `prisma migrate deploy` inside the environment's budget.
import pg from 'pg';

import { migrate, postgresAdapter } from '../dist/index.js';

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
    process.env.DATABASE_SSL === 'no-verify'
      ? { rejectUnauthorized: false }
      : process.env.DATABASE_SSL === 'true',
});

try {
  const applied = await migrate(postgresAdapter({ pool }));
  console.log(
    applied.length > 0
      ? `helpdesk: applied ${applied.join(', ')}`
      : 'helpdesk: up to date'
  );
} finally {
  await pool.end();
}
