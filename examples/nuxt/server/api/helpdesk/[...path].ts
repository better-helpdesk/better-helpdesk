import { helpdesk, migrated } from '../../lib/helpdesk';

// Every method under the base path. h3 builds a web Request from the event
// and sends the Response the handler returns as it is.
export default defineEventHandler(async event => {
  await migrated;
  return helpdesk.handler(toWebRequest(event));
});
