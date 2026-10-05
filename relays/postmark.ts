/**
 * Relay for Postmark's inbound webhook: takes the JSON Postmark posts and
 * forwards its `RawEmail`, unmodified, to the helpdesk's `/inbound/` route.
 * It is a `fetch(request, env)` handler, so it deploys as a Cloudflare Worker
 * and runs on Deno or Bun as it is. Bind:
 *   HELPDESK_INBOUND_URL    e.g. https://app.example.com/api/helpdesk/inbound/
 *   HELPDESK_INBOUND_SECRET the host's inboundWebhookSecret
 *   POSTMARK_WEBHOOK_SECRET the password in the webhook URL you give Postmark,
 *                           https://postmark:<secret>@relay.example.com/
 * and tick "Include raw email content in JSON payload" in Postmark's inbound
 * stream settings.
 */
export interface Env {
  HELPDESK_INBOUND_URL: string;
  HELPDESK_INBOUND_SECRET: string;
  POSTMARK_WEBHOOK_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { allow: 'POST' } });
    }
    if (!(await authorized(request, env.POSTMARK_WEBHOOK_SECRET))) {
      return new Response(null, {
        status: 401,
        headers: { 'www-authenticate': 'Basic' },
      });
    }
    let raw: unknown;
    try {
      raw = ((await request.json()) as { RawEmail?: unknown }).RawEmail;
    } catch {
      raw = undefined;
    }
    // Postmark stops retrying on a 403 and retries anything else that is
    // not a 200, so a message the helpdesk can never take answers 403.
    if (typeof raw !== 'string' || raw === '') {
      return new Response('No RawEmail in the payload', { status: 403 });
    }
    let status = 0;
    try {
      const response = await fetch(env.HELPDESK_INBOUND_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.HELPDESK_INBOUND_SECRET}`,
          'content-type': 'message/rfc822',
        },
        body: raw,
      });
      status = response.status;
    } catch {
      status = 0;
    }
    if (status >= 200 && status < 300) return new Response(null);
    if (status === 400 || status === 413) {
      return new Response(`Helpdesk refused the message (${status})`, {
        status: 403,
      });
    }
    return new Response(`Helpdesk unavailable (${status || 'unreachable'})`, {
      status: 502,
    });
  },
};

async function authorized(request: Request, secret: string) {
  const header = request.headers.get('authorization') ?? '';
  if (!secret || !header.startsWith('Basic ')) return false;
  let password: string;
  try {
    password = atob(header.slice(6)).split(':').slice(1).join(':');
  } catch {
    return false;
  }
  const [given, expected] = await Promise.all([
    digest(password),
    digest(secret),
  ]);
  return given === expected;
}

async function digest(value: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}
