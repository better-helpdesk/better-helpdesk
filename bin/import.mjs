#!/usr/bin/env node
// Imports contacts and their companies, or canned replies, from a CSV file:
//   better-helpdesk-import contacts people.csv
//   better-helpdesk-import canned replies.csv
// Running it again updates what it added before instead of duplicating it.
import { readFile } from 'node:fs/promises';

import pg from 'pg';

import {
  importCannedReplies,
  importContacts,
  parseCsv,
} from '../dist/import.js';
import { postgresAdapter } from '../dist/index.js';

const [kind, file] = process.argv.slice(2);
const run = { contacts: importContacts, canned: importCannedReplies }[kind];
if (!run || !file) {
  console.error('Usage: better-helpdesk-import contacts|canned <file.csv>');
  process.exit(1);
}
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
  const { created, updated, skipped } = await run(
    postgresAdapter({ pool }),
    parseCsv(await readFile(file, 'utf8'))
  );
  console.log(
    `helpdesk: ${created} created, ${updated} updated, ${skipped} skipped`
  );
} finally {
  await pool.end();
}
