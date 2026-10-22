#!/usr/bin/env node
// Imports contacts and their companies, or canned replies, from a CSV file,
// or conversation history from the JSON Lines file bin/export.mjs writes:
//   better-helpdesk-import contacts people.csv [--lead-stages lead,customer]
//   better-helpdesk-import canned replies.csv
//   better-helpdesk-import conversations history.jsonl [--source Freshdesk]
// Running a CSV import again adds what is new and changes nothing an agent
// edited; a conversation import opens every line anew, so run it once.
import { readFile } from 'node:fs/promises';

import { importConversations } from '../dist/export.js';
import {
  importCannedReplies,
  importContacts,
  parseCsv,
} from '../dist/import.js';
import { createStore } from '../dist/index.js';
import { openDatabase } from './database.mjs';

const [kind, file, flag, value] = process.argv.slice(2);
const run = {
  contacts: importContacts,
  canned: importCannedReplies,
  conversations: importConversations,
}[kind];
const flags = { contacts: '--lead-stages', conversations: '--source' };
if (!run || !file || (flag && (flag !== flags[kind] || !value))) {
  console.error(
    'Usage: better-helpdesk-import contacts|canned <file.csv> [--lead-stages a,b,c]\n       better-helpdesk-import conversations <file.jsonl> [--source Freshdesk]'
  );
  process.exit(1);
}
// The stages set in the host's `leadStages`; the package's defaults otherwise.
const leadStages =
  kind === 'contacts'
    ? value
        ?.split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : undefined;
const source = kind === 'conversations' ? value : undefined;
const connectionString =
  process.env.HELPDESK_DATABASE_URL || process.env.APP_DATABASE_URL;
if (!connectionString) {
  console.error('HELPDESK_DATABASE_URL or APP_DATABASE_URL must be set');
  process.exit(1);
}

// Read and checked before connecting, so a broken file writes nothing.
let rows;
try {
  const text = await readFile(file, 'utf8');
  rows = kind === 'conversations' ? text.split('\n') : parseCsv(text);
} catch (error) {
  console.error(`helpdesk: ${error.message}`);
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
  const { created, updated, skipped, notes } = await run(
    createStore(database.adapter),
    rows,
    { leadStages, source }
  );
  for (const note of notes) console.warn(`helpdesk: ${note}`);
  console.log(
    `helpdesk: ${created} created, ${updated} updated, ${skipped} unchanged or skipped`
  );
} finally {
  await database.close();
}
