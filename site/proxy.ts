import { type NextRequest, NextResponse } from 'next/server';

import { AGENT_REALM, isAgentRequest } from './lib/agent';

// Only the agent UI and its API ask for credentials. The widget, inbound mail
// and jobs routes under /helpdesk/api/ stay open; the handler guards them.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const api = pathname.startsWith('/helpdesk/api/');
  if (api && !pathname.startsWith('/helpdesk/api/agent/')) {
    return NextResponse.next();
  }
  if (isAgentRequest(request.headers)) return NextResponse.next();
  return new NextResponse('Sign in to open the inbox.', {
    status: 401,
    headers: {
      'www-authenticate': `Basic realm="${AGENT_REALM}", charset="UTF-8"`,
    },
  });
}

export const config = { matcher: ['/helpdesk/:path*'] };
