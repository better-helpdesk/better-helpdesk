import { DatabaseSync } from 'node:sqlite';

import { buildHelpdesk, migrate, sqliteAdapter } from 'better-helpdesk';

export const ROLE_COOKIE = 'example-role';

// Anyone who sets the cookie becomes an agent: fine on your own machine, a
// breach anywhere else.
if (import.meta.env.PROD && process.env.DEMO_UNSAFE_AUTH !== '1') {
  throw new Error(
    'This example hands the agent UI to anyone who sets a cookie. Set DEMO_UNSAFE_AUTH=1 to run the build anyway.'
  );
}

const origin = process.env.APP_URL ?? 'http://localhost:4321';

export const db = sqliteAdapter({
  database: new DatabaseSync(process.env.HELPDESK_SQLITE ?? 'helpdesk.db'),
});

// Once per server start; on a server, run `better-helpdesk-migrate` as a
// deploy step instead.
await migrate(db);

/** Whether the request carries the cookie the sign-in button on the home page sets. */
export function isAgent(request: Request) {
  const cookies = request.headers.get('cookie') ?? '';
  return cookies
    .split(';')
    .some(pair => pair.trim() === `${ROLE_COOKIE}=agent`);
}

export const helpdesk = buildHelpdesk({
  db,
  basePath: '/api/helpdesk',
  referencePrefix: 'ASTRO',
  // The same-origin check on mutations compares against this origin.
  adminUrl: `${origin}/helpdesk/`,
  inboxes: {
    support: { name: { en: 'Support' }, public: true },
  },
  // A real app returns the signed-in user from its session here, with
  // `isAgent: true` for the support team.
  identify: async request =>
    isAgent(request)
      ? {
          user: {
            id: 'example-agent',
            email: 'alex@example.test',
            emailVerified: true,
            name: 'Alex Agent',
          },
          orgs: [],
          isAgent: true,
        }
      : null,
});
