/**
 * Relay for a Mailgun inbound route: takes the form Mailgun posts to a
 * `forward()` URL that ends in `mime` and forwards its `body-mime`,
 * unmodified, to the helpdesk's `/inbound/` route. It is a
 * `fetch(request, env)` handler, so it deploys as a Cloudflare Worker and
 * runs on Deno or Bun as it is. Bind:
 *   HELPDESK_INBOUND_URL        e.g. https://app.example.com/api/helpdesk/inbound/
 *   HELPDESK_INBOUND_SECRET     the host's inboundWebhookSecret
 *   MAILGUN_WEBHOOK_SIGNING_KEY from Mailgun's Settings → Webhooks
 * and point the route at https://relay.example.com/mime: without the
 * `mime` suffix Mailgun posts the parsed message and no raw copy.
 */
export interface Env {
  HELPDESK_INBOUND_URL: string;
  HELPDESK_INBOUND_SECRET: string;
  MAILGUN_WEBHOOK_SIGNING_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { allow: 'POST' } });
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return new Response('Not a form', { status: 406 });
    }
    if (!(await authorized(form, env.MAILGUN_WEBHOOK_SIGNING_KEY))) {
      return new Response(null, { status: 401 });
    }
    // Mailgun stops retrying on a 406 and retries anything else that is
    // not a 200 for eight hours, so a message the helpdesk can never take
    // answers 406.
    const raw = form.get('body-mime');
    if (typeof raw !== 'string' || raw === '') {
      return new Response(
        'No body-mime in the payload: the route URL must end in /mime',
        { status: 406 }
      );
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
        status: 406,
      });
    }
    return new Response(`Helpdesk unavailable (${status || 'unreachable'})`, {
      status: 502,
    });
  },
};

// No timestamp window: a replayed request re-posts a message whose
// Message-ID the helpdesk already skips.
async function authorized(form: FormData, key: string) {
  const timestamp = form.get('timestamp');
  const token = form.get('token');
  const signature = form.get('signature');
  if (
    !key ||
    typeof timestamp !== 'string' ||
    typeof token !== 'string' ||
    typeof signature !== 'string'
  ) {
    return false;
  }
  const expected = await hmac(key, timestamp + token);
  const [given, wanted] = await Promise.all([
    digest(signature),
    digest(expected),
  ]);
  return given === wanted;
}

async function hmac(key: string, message: string) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(mac), b =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

async function digest(value: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}
