import { generateKeyPairSync } from 'node:crypto';

import { dkimSign } from 'mailauth';
import { describe, expect, it } from 'vitest';

import { fromDomainSigned, signatureCount, signsFrom } from './verify';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const record = `v=DKIM1; k=rsa; p=${publicKey
  .export({ type: 'spki', format: 'der' })
  .toString('base64')}`;
const resolver = async (name: string, type: string) => {
  if (type === 'TXT' && name === 'sel._domainkey.example.ch') return [[record]];
  const error = new Error('not found') as Error & { code: string };
  error.code = 'ENOTFOUND';
  throw error;
};

const message = (from: string, extraFrom?: string) =>
  Buffer.from(
    [
      `From: Anna <${from}>`,
      ...(extraFrom ? [`From: ${extraFrom}`] : []),
      'To: support@devguard.ch',
      'Subject: Hi',
      'Message-ID: <m@example.ch>',
      '',
      'Hello',
      '',
    ].join('\r\n')
  );

async function signed(
  from: string,
  signingDomain: string,
  extraFrom?: string,
  options: { maxBodyLength?: number } = {}
) {
  const raw = message(from, extraFrom);
  const { signatures } = await dkimSign(raw, {
    signatureData: [
      {
        signingDomain,
        selector: 'sel',
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        maxBodyLength: options.maxBodyLength,
      },
    ],
  } as Parameters<typeof dkimSign>[1]);
  return Buffer.concat([Buffer.from(signatures), raw]);
}

describe('fromDomainSigned', () => {
  it('accepts a message the From domain signed', async () => {
    expect(
      await fromDomainSigned(
        await signed('anna@example.ch', 'example.ch'),
        'anna@example.ch',
        resolver
      )
    ).toBe(true);
  });

  it('refuses an unsigned message', async () => {
    expect(
      await fromDomainSigned(
        message('anna@example.ch'),
        'anna@example.ch',
        resolver
      )
    ).toBe(false);
  });

  it('refuses a signature from a domain other than From', async () => {
    expect(
      await fromDomainSigned(
        await signed('ceo@victim.ch', 'example.ch'),
        'ceo@victim.ch',
        resolver
      )
    ).toBe(false);
  });

  it('refuses a message altered after signing', async () => {
    const raw = (await signed('anna@example.ch', 'example.ch'))
      .toString()
      .replace('Hello', 'Pay now');
    expect(
      await fromDomainSigned(Buffer.from(raw), 'anna@example.ch', resolver)
    ).toBe(false);
  });

  it('refuses a second From header that the signature does not vouch for', async () => {
    const raw = await signed('anna@example.ch', 'example.ch', 'ceo@victim.ch');
    expect(await fromDomainSigned(raw, 'ceo@victim.ch', resolver)).toBe(false);
    expect(await fromDomainSigned(raw, 'anna@example.ch', resolver)).toBe(
      false
    );
  });

  it('refuses a signature that covers only part of the body', async () => {
    const raw = await signed('anna@example.ch', 'example.ch', undefined, {
      maxBodyLength: 2,
    });
    expect(await fromDomainSigned(raw, 'anna@example.ch', resolver)).toBe(
      false
    );
  });
});

describe('bounded verification', () => {
  it('refuses a message with more signatures than real mail carries, without looking any up', async () => {
    const one = await signed('anna@example.ch', 'example.ch');
    const header = one
      .toString()
      .split('\r\n\r\n')[0]
      ?.split(/\r\nFrom:/)[0];
    const many = Buffer.concat([Buffer.from(`${header}\r\n`.repeat(5)), one]);
    expect(signatureCount(many)).toBe(6);
    let lookups = 0;
    expect(
      await fromDomainSigned(many, 'anna@example.ch', async (name, type) => {
        lookups++;
        return resolver(name, type);
      })
    ).toBe(false);
    expect(lookups).toBe(0);
  });

  it('gives up as unverified when key lookups never answer', async () => {
    const raw = await signed('anna@example.ch', 'example.ch');
    const started = Date.now();
    expect(
      await fromDomainSigned(
        raw,
        'anna@example.ch',
        () => new Promise(() => {}),
        { deadlineMs: 100 }
      )
    ).toBe(false);
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});

// mailauth's verifier accepts a signature whose h= leaves From out; its signer
// never produces one, so the rule is checked on the header list directly.
describe('signsFrom', () => {
  it('needs From among the signed headers', () => {
    expect(signsFrom('Message-ID: Subject: To: From')).toBe(true);
    expect(signsFrom('message-id:subject:to')).toBe(false);
    expect(signsFrom(undefined)).toBe(false);
  });
});
