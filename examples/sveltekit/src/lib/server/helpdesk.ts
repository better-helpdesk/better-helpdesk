import { DatabaseSync } from 'node:sqlite';

import { buildHelpdesk, migrate, sqliteAdapter } from 'better-helpdesk';

const db = sqliteAdapter({
  database: new DatabaseSync(process.env.HELPDESK_SQLITE ?? 'helpdesk.db'),
});
await migrate(db);

export const helpdesk = buildHelpdesk({
  db,
  basePath: '/api/helpdesk',
  referencePrefix: 'KIT',
  // The same-origin check on mutations compares against this origin.
  adminUrl: `${process.env.ORIGIN ?? 'http://localhost:5173'}/helpdesk/`,
  inboxes: {
    support: { name: { en: 'Support' }, public: true },
  },
  // Visitors only. A real app returns the signed-in user here, from
  // `event.locals` or its session, and `isAgent: true` for the support team.
  identify: async () => null,
});
