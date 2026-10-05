// app/api/cron/helpdesk/route.ts, scheduled in vercel.json:
// { "crons": [{ "path": "/api/cron/helpdesk", "schedule": "*/5 * * * *" }] }
// Vercel sends CRON_SECRET as a bearer token when the project sets one.
import { helpdesk } from '@/lib/helpdesk';

export const maxDuration = 30;

export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (request.headers.get('authorization') !== expected) {
    return new Response(null, { status: 401 });
  }
  return Response.json(await helpdesk.runJobs({ budgetMs: 20_000 }));
}
