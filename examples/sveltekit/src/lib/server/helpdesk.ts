import { DatabaseSync } from 'node:sqlite';

import { buildHelpdesk, sqliteAdapter } from 'better-helpdesk';

import { origin } from '../../../origin';

export const db = sqliteAdapter({
  database: new DatabaseSync(process.env.HELPDESK_SQLITE ?? 'helpdesk.db'),
});

export const helpdesk = buildHelpdesk({
  db,
  basePath: '/api/helpdesk',
  referencePrefix: 'KIT',
  // The same-origin check on mutations compares against this origin.
  adminUrl: `${origin}/helpdesk/`,
  inboxes: {
    support: { name: { en: 'Support' }, public: true },
  },
  // Visitors only. A real app returns the signed-in user here, from
  // `event.locals` or its session, and `isAgent: true` for the support team.
  identify: async () => null,
});
