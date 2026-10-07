#!/usr/bin/env node
// Applies the support schema migrations. One connection, closed on exit, so it
// can run next to `prisma migrate deploy` inside the environment's budget.
import { migrate } from '../dist/index.js';
import { openDatabase } from './database.mjs';

const connectionString =
  process.env.HELPDESK_DATABASE_URL || process.env.APP_DATABASE_URL;
if (!connectionString) {
  console.error('HELPDESK_DATABASE_URL or APP_DATABASE_URL must be set');
  process.exit(1);
}

let database;
try {
  database = await openDatabase(connectionString);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

try {
  const applied = await migrate(database.adapter);
  console.log(
    applied.length > 0
      ? `helpdesk: applied ${applied.join(', ')}`
      : 'helpdesk: up to date'
  );
} finally {
  await database.close();
}
