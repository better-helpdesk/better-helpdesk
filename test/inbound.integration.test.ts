import { generateKeyPairSync } from 'node:crypto';

import { dkimSign } from 'mailauth';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_ORIGIN, createHarness } from './harness';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const record = `v=DKIM1; k=rsa; p=${publicKey.export({ type: 'spki', format: 'der' }).toString('base64')}`;

const h = createHarness({
  inboundWebhookSecret: 'inbound-secret',
  dnsResolver: async (name, type) => {
    if (type === 'TXT' && name === 'sel._domainkey.example.test')
      return [[record]];
    throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' });
  },
});

beforeEach(() => h.reset());
afterAll(() => h.close());

async function email(to: string, text: string, { sign = true } = {}) {
  const raw = Buffer.from(
    [
      'From: Carol <carol@example.test>',
      `To: ${to}`,
      'Subject: Re: Export',
      `Message-ID: <${Math.random()}@example.test>`,
      '',
      text,
      '',
    ].join('\r\n')
  );
  if (!sign) return raw;
  const { signatures } = await dkimSign(raw, {
    signatureData: [
      {
        signingDomain: 'example.test',
        selector: 'sel',
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      },
    ],
  } as Parameters<typeof dkimSign>[1]);
  return Buffer.concat([Buffer.from(signatures), raw]);
}

function post(body: Buffer, secret = 'inbound-secret') {
  return h.support.handler(
    new Request(`${ADMIN_ORIGIN}/api/helpdesk/inbound/`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'message/rfc822',
      },
      body: new Uint8Array(body),
    })
  );
}

describe('inbound webhook', () => {
  it('refuses a caller without the secret', async () => {
    expect(
      (await post(await email('support@devguard.test', 'hi'), 'nope')).status
    ).toBe(401);
    expect(await h.count('conversation')).toBe(0);
  });

  it('refuses a header block too large to parse safely', async () => {
    const huge = Buffer.from(`X-Filler: ${'a'.repeat(70_000)}\r\n\r\nhi\r\n`);
    expect((await post(huge)).status).toBe(413);
    expect(await h.count('conversation')).toBe(0);
  });

  it('threads a signed reply into the sender’s conversation', async () => {
    h.addUser('carol', { email: 'carol@example.test' });
    const created = await h.call('POST', 'widget/conversations', {
      user: 'carol',
      body: { inbox: 'support', type: 'question', body: 'first' },
    });
    const reference = created.data.conversation.reference;
    const res = await post(
      await email(`support+${reference}@devguard.test`, 'Thanks')
    );
    expect(res.status).toBe(202);
    expect(
      await h.count('message', {
        body: 'Thanks',
        conversationId: created.data.conversation.id,
      })
    ).toBe(1);
  });

  it('opens a new conversation for an unsigned reply', async () => {
    h.addUser('carol', { email: 'carol@example.test' });
    const created = await h.call('POST', 'widget/conversations', {
      user: 'carol',
      body: { inbox: 'support', type: 'question', body: 'first' },
    });
    const reference = created.data.conversation.reference;
    await post(
      await email(`support+${reference}@devguard.test`, 'forged', {
        sign: false,
      })
    );
    expect(await h.count('conversation')).toBe(2);
  });
});

describe('verified email and the widget', () => {
  it('takes the visitor token off a contact once its address is proven', async () => {
    const typed = await h.call('POST', 'widget/conversations', {
      body: {
        inbox: 'sales',
        type: 'lead',
        body: 'hello',
        email: 'carol@example.test',
      },
    });
    const token = typed.data.visitorToken as string;
    const reference = typed.data.conversation.reference;
    expect(
      (await post(await email(`support+${reference}@devguard.test`, 'Who?')))
        .status
    ).toBe(202);

    h.addUser('carol', { email: 'carol@example.test' });
    await h.call('POST', 'widget/conversations', {
      user: 'carol',
      body: { inbox: 'support', type: 'question', body: 'in-app' },
    });

    const session = await h.call('GET', 'widget/session?inbox=sales', {
      headers: { 'x-helpdesk-visitor': token },
    });
    expect(session.data.conversations).toHaveLength(0);
  });

  it('keeps the app identity when an emailing customer later writes in the app', async () => {
    expect(
      (await post(await email('support@devguard.test', 'first by mail'))).status
    ).toBe(202);
    h.addUser('carol', { email: 'carol@example.test' });
    const created = await h.call('POST', 'widget/conversations', {
      user: 'carol',
      body: { inbox: 'support', type: 'question', body: 'then in-app' },
    });
    const session = await h.call('GET', 'widget/session?inbox=support', {
      user: 'carol',
    });
    expect(
      session.data.conversations.map((c: { id: string }) => c.id)
    ).toContain(created.data.conversation.id);
  });
});
