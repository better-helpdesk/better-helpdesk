import type { APIRoute } from 'astro';

import { helpdesk } from '../../../lib/helpdesk';

// Every method under the base path, including the PUT, PATCH and DELETE the
// agent UI sends.
export const ALL: APIRoute = ({ request }) => helpdesk.handler(request);
