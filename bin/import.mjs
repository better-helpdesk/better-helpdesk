#!/usr/bin/env node
// Imports contacts and their companies, or canned replies, from a CSV file:
//   better-helpdesk-import contacts people.csv [--lead-stages lead,customer]
//   better-helpdesk-import canned replies.csv
// Running it again adds what is new and changes nothing an agent edited.
import { readFile } from 'node:fs/promises';

import pg from 'pg';

import {
  importCannedReplies,
  importContacts,
  parseCsv,
} from '../dist/import.js';
import { postgresAdapter } from '../dist/index.js';

const [kind, file, flag, value] = process.argv.slice(2);
const run = { contacts: importContacts, canned: importCannedReplies }[kind];
if (!run || !file || (flag && (flag !== '--lead-stages' || !value))) {
  console.error(
    'Usage: better-helpdesk-import contacts|canned <file.csv> [--lead-stages a,b,c]'
  );
  process.exit(1);
}
// The stages set in the host's `leadStages`; the package's defaults otherwise.
const leadStages = value
  ?.split(',')
  .map(s => s.trim())
  .filter(Boolean);
const connectionString =
  process.env.HELPDESK_DATABASE_URL || process.env.APP_DATABASE_URL;
if (!connectionString) {
  console.error('HELPDESK_DATABASE_URL or APP_DATABASE_URL must be set');
  process.exit(1);
}

// Read and checked before connecting, so a broken file writes nothing.
let rows;
try {
  rows = parseCsv(await readFile(file, 'utf8'));
} catch (error) {
  console.error(`helpdesk: ${error.message}`);
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
  const { created, updated, skipped, notes } = await run(
    postgresAdapter({ pool }),
    rows,
    { leadStages }
  );
  for (const note of notes) console.warn(`helpdesk: ${note}`);
  console.log(
    `helpdesk: ${created} created, ${updated} updated, ${skipped} unchanged or skipped`
  );
} finally {
  await pool.end();
}
