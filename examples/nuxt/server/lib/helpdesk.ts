import { DatabaseSync } from 'node:sqlite';

import { buildHelpdesk, migrate, sqliteAdapter } from 'better-helpdesk';

const origin = process.env.APP_URL ?? 'http://localhost:3000';

const db = sqliteAdapter({
  database: new DatabaseSync(process.env.HELPDESK_SQLITE ?? 'helpdesk.db'),
});

// Starts once per server, and the route waits for it before answering; on a
// server, run `better-helpdesk-migrate` as a deploy step instead.
export const migrated = migrate(db);

export const helpdesk = buildHelpdesk({
  db,
  basePath: '/api/helpdesk',
  referencePrefix: 'NUXT',
  // The same-origin check on mutations compares against this origin.
  adminUrl: `${origin}/helpdesk/`,
  inboxes: {
    support: { name: { en: 'Support' }, public: true },
  },
  // Visitors only. A real app returns the signed-in user here, and
  // `isAgent: true` for the support team.
  identify: async () => null,
});
