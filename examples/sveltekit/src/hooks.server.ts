import { migrate } from 'better-helpdesk';

import { db } from './lib/server/helpdesk';

// Once per server start, not during the build: on a server, run
// `better-helpdesk-migrate` as a deploy step instead.
export async function init() {
  await migrate(db);
}
