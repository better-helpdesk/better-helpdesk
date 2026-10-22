#!/usr/bin/env node
// Writes every conversation as one JSON object per line to stdout, with its
// messages, people, tags and timeline, in the format bin/import.mjs reads:
//   better-helpdesk-export [--since 2026-01-01] [--prefix ACME] > conversations.jsonl
// --prefix is the referencePrefix of your config, so the references match
// what customers were told.
import { exportConversations } from '../dist/export.js';
import { createStore } from '../dist/index.js';
import { openDatabase } from './database.mjs';

const args = process.argv.slice(2);
const flag = name => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const sinceArg = flag('--since');
const since = sinceArg ? new Date(sinceArg) : undefined;
const prefix = flag('--prefix') ?? 'HD';
const known = new Set(['--since', '--prefix']);
if (
  args.some(a => a.startsWith('--') && !known.has(a)) ||
  args.some((a, i) => !a.startsWith('--') && !known.has(args[i - 1])) ||
  (since && Number.isNaN(since.getTime()))
) {
  console.error(
    'Usage: better-helpdesk-export [--since YYYY-MM-DD] [--prefix ACME]'
  );
  process.exit(1);
}
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

let count = 0;
try {
  for await (const conversation of exportConversations(
    createStore(database.adapter),
    { since, prefix }
  )) {
    process.stdout.write(`${JSON.stringify(conversation)}\n`);
    count++;
  }
  console.error(`helpdesk: ${count} conversations exported`);
} finally {
  await database.close();
}
