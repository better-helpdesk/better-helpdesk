import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import relay, { type Env } from './postmark';

const payload = readFileSync(
  new URL('./fixtures/postmark-inbound.json', import.meta.url),
  'utf8'
);
const { RawEmail } = JSON.parse(payload) as { RawEmail: string };

const env: Env = {
  HELPDESK_INBOUND_URL: 'https://app.harbor.test/api/helpdesk/inbound/',
  HELPDESK_INBOUND_SECRET: 'inbound-secret',
  POSTMARK_WEBHOOK_SECRET: 'webhook-secret',
};

function fromPostmark(body: string, password = env.POSTMARK_WEBHOOK_SECRET) {
  return new Request('https://relay.harbor.test/', {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`postmark:${password}`)}`,
      'content-type': 'application/json',
    },
    body,
  });
}

function helpdeskAnswers(status: number) {
  const sent: Request[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    sent.push(new Request(url, init));
    return new Response(null, { status });
  });
  return sent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Postmark relay', () => {
  it('forwards the raw message to the inbound route with the bearer secret', async () => {
    const sent = helpdeskAnswers(202);

    const response = await relay.fetch(fromPostmark(payload), env);

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    const [request] = sent;
    expect(request?.method).toBe('POST');
    expect(request?.url).toBe(env.HELPDESK_INBOUND_URL);
    expect(request?.headers.get('authorization')).toBe('Bearer inbound-secret');
    expect(request?.headers.get('content-type')).toBe('message/rfc822');
    expect(await request?.text()).toBe(RawEmail);
  });

  it('refuses a request without the webhook password', async () => {
    const sent = helpdeskAnswers(202);

    const wrong = await relay.fetch(fromPostmark(payload, 'guess'), env);
    const none = await relay.fetch(
      new Request('https://relay.harbor.test/', {
        method: 'POST',
        body: payload,
      }),
      env
    );

    expect(wrong.status).toBe(401);
    expect(none.status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it('answers 403 so Postmark stops retrying when there is no raw message', async () => {
    const sent = helpdeskAnswers(202);
    const { RawEmail: _, ...withoutRaw } = JSON.parse(payload);

    const missing = await relay.fetch(
      fromPostmark(JSON.stringify(withoutRaw)),
      env
    );
    const garbled = await relay.fetch(fromPostmark('not json'), env);

    expect(missing.status).toBe(403);
    expect(garbled.status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it('answers 403 when the helpdesk can never take the message', async () => {
    helpdeskAnswers(413);

    const response = await relay.fetch(fromPostmark(payload), env);

    expect(response.status).toBe(403);
  });

  it('answers 502 so Postmark retries when the helpdesk is down or misconfigured', async () => {
    helpdeskAnswers(503);
    const down = await relay.fetch(fromPostmark(payload), env);
    helpdeskAnswers(401);
    const misconfigured = await relay.fetch(fromPostmark(payload), env);
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed');
    });
    const unreachable = await relay.fetch(fromPostmark(payload), env);

    expect(down.status).toBe(502);
    expect(misconfigured.status).toBe(502);
    expect(unreachable.status).toBe(502);
  });
});
