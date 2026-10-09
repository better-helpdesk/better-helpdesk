import { helpdesk } from '../../../../lib/server/helpdesk';
import type { RequestHandler } from './$types';

// The widget and the agent UI request paths with a trailing slash; without
// this SvelteKit would redirect them to the same path without it.
export const trailingSlash = 'ignore';

export const fallback: RequestHandler = ({ request }) =>
  helpdesk.handler(request);
