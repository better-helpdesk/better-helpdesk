import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import relay, { type Env } from './mailgun';

const fields = JSON.parse(
  readFileSync(
    new URL('./fixtures/mailgun-inbound.json', import.meta.url),
    'utf8'
  )
) as Record<string, string>;
const raw = fields['body-mime'] as string;

const env: Env = {
  HELPDESK_INBOUND_URL: 'https://app.harbor.test/api/helpdesk/inbound/',
  HELPDESK_INBOUND_SECRET: 'inbound-secret',
  MAILGUN_WEBHOOK_SIGNING_KEY: 'signing-key',
};

function fromMailgun(form: Record<string, string> = fields) {
  return new Request('https://relay.harbor.test/mime', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
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

describe('Mailgun relay', () => {
  it('forwards the raw message to the inbound route with the bearer secret', async () => {
    const sent = helpdeskAnswers(202);

    const response = await relay.fetch(fromMailgun(), env);

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    const [request] = sent;
    expect(request?.method).toBe('POST');
    expect(request?.url).toBe(env.HELPDESK_INBOUND_URL);
    expect(request?.headers.get('authorization')).toBe('Bearer inbound-secret');
    expect(request?.headers.get('content-type')).toBe('message/rfc822');
    expect(await request?.text()).toBe(raw);
  });

  it('also takes the multipart form Mailgun posts', async () => {
    const sent = helpdeskAnswers(202);
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.set(name, value);

    const response = await relay.fetch(
      new Request('https://relay.harbor.test/mime', {
        method: 'POST',
        body: form,
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(await sent[0]?.text()).toBe(raw);
  });

  it('refuses a request whose signature is wrong or missing', async () => {
    const sent = helpdeskAnswers(202);

    const forged = await relay.fetch(
      fromMailgun({ ...fields, signature: 'f'.repeat(64) }),
      env
    );
    const tampered = await relay.fetch(
      fromMailgun({ ...fields, token: 'another-token' }),
      env
    );
    const { signature: _, ...unsigned } = fields;
    const none = await relay.fetch(fromMailgun(unsigned), env);
    const noKey = await relay.fetch(fromMailgun(), {
      ...env,
      MAILGUN_WEBHOOK_SIGNING_KEY: '',
    });

    expect(forged.status).toBe(401);
    expect(tampered.status).toBe(401);
    expect(none.status).toBe(401);
    expect(noKey.status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it('answers 406 so Mailgun stops retrying when there is no raw message', async () => {
    const sent = helpdeskAnswers(202);
    const { 'body-mime': _, ...parsedOnly } = fields;

    const missing = await relay.fetch(fromMailgun(parsedOnly), env);
    const garbled = await relay.fetch(
      new Request('https://relay.harbor.test/mime', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      env
    );

    expect(missing.status).toBe(406);
    expect(garbled.status).toBe(406);
    expect(sent).toHaveLength(0);
  });

  it('answers 406 when the helpdesk can never take the message', async () => {
    helpdeskAnswers(413);

    const response = await relay.fetch(fromMailgun(), env);

    expect(response.status).toBe(406);
  });

  it('answers 502 so Mailgun retries when the helpdesk is down or misconfigured', async () => {
    helpdeskAnswers(503);
    const down = await relay.fetch(fromMailgun(), env);
    helpdeskAnswers(401);
    const misconfigured = await relay.fetch(fromMailgun(), env);
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed');
    });
    const unreachable = await relay.fetch(fromMailgun(), env);

    expect(down.status).toBe(502);
    expect(misconfigured.status).toBe(502);
    expect(unreachable.status).toBe(502);
  });
});
