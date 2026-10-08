import { afterEach, expect, test, vi } from 'vitest';

import { email } from './email-postmark';

function postmark(status: number, body: unknown) {
  const fetch = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

test('a customer reply reaches Postmark as a plain-text thread reply', async () => {
  process.env.POSTMARK_SERVER_TOKEN = 'token';
  const fetch = postmark(200, { ErrorCode: 0, Message: 'OK' });
  await email.send({
    kind: 'customer-reply',
    to: 'maya@customer.test',
    locale: 'en',
    reference: 'HD-12',
    subject: 'Login fails',
    body: 'Try again now.',
    agentName: 'Sam',
    replyTo: 'reply+HD-12@acme.test',
    inReplyTo: '<abc@customer.test>',
  });
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.postmarkapp.com/email');
  expect(new Headers(init.headers).get('X-Postmark-Server-Token')).toBe(
    'token'
  );
  expect(JSON.parse(init.body as string)).toEqual({
    From: 'Acme Support <support@example.com>',
    To: 'maya@customer.test',
    MessageStream: 'outbound',
    Subject: 'Re: Login fails',
    TextBody: 'Try again now.\n\nSam',
    ReplyTo: 'reply+HD-12@acme.test',
    Headers: [{ Name: 'In-Reply-To', Value: '<abc@customer.test>' }],
  });
});

test("a rejected send throws with Postmark's message, so the job retries", async () => {
  postmark(422, { ErrorCode: 300, Message: 'Invalid email request' });
  await expect(
    email.send({
      kind: 'agent-new',
      to: 'sam@acme.test',
      locale: 'en',
      reference: 'HD-13',
      subject: 'New conversation',
      body: 'Hello',
      url: 'https://acme.test/helpdesk/HD-13',
    })
  ).rejects.toThrow('Postmark 300: Invalid email request');
});
