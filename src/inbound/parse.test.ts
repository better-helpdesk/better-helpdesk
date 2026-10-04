import { describe, expect, it } from 'vitest';

import { stripQuoted, toInbound } from './parse';

describe('stripQuoted', () => {
  it('keeps the reply and drops the quoted history', () => {
    expect(
      stripQuoted(
        'Thanks, works now.\n\nOn Mon, 1 Sep 2026 at 10:00, Support <s@x.ch> wrote:\n> Try again'
      )
    ).toBe('Thanks, works now.');
    expect(
      stripQuoted('Danke!\n\nAm 1.9.2026 um 10:00 schrieb Support:\n> Hallo')
    ).toBe('Danke!');
  });

  it('returns the whole text when nothing is quoted', () => {
    expect(stripQuoted('Hello\nsecond line')).toBe('Hello\nsecond line');
  });

  it('reads a crafted long line quickly', () => {
    const line = `am ${' schrieb:'.repeat(40_000)}x`;
    const start = performance.now();
    expect(stripQuoted(line)).toBe(line);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

const trust = (verdict: boolean) => async () => verdict;

const raw = [
  'Authentication-Results: mx.google.com;',
  '       dkim=pass header.i=@example.ch;',
  '       spf=pass smtp.mailfrom=anna@example.ch;',
  '       dmarc=pass (p=QUARANTINE) header.from=example.ch',
  'From: Anna Muster <Anna@Example.ch>',
  'To: support+DG-1042@devguard.ch',
  'Subject: Re: [DG-1042] Export',
  'Message-ID: <reply-1@example.ch>',
  'In-Reply-To: <orig@devguard.ch>',
  'References: <orig@devguard.ch>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="b"',
  '',
  '--b',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Works now, thanks.',
  '',
  'On Mon, 1 Sep 2026 at 10:00, Support <support@devguard.ch> wrote:',
  '> Please try again',
  '--b',
  'Content-Type: image/png; name="shot.png"',
  'Content-Disposition: attachment; filename="shot.png"',
  'Content-Transfer-Encoding: base64',
  '',
  'iVBORw0KGgo=',
  '--b--',
  '',
].join('\r\n');

describe('toInbound', () => {
  it('turns a raw reply into a verified, threadable message', async () => {
    const message = await toInbound(Buffer.from(raw), trust(true));
    expect(message).toMatchObject({
      messageId: '<reply-1@example.ch>',
      from: { address: 'Anna@Example.ch', name: 'Anna Muster' },
      to: ['support+DG-1042@devguard.ch'],
      inReplyTo: '<orig@devguard.ch>',
      references: ['<orig@devguard.ch>'],
      text: 'Works now, thanks.',
      verified: true,
    });
    expect(message.attachments).toEqual([
      expect.objectContaining({
        filename: 'shot.png',
        contentType: 'image/png',
      }),
    ]);
  });

  it('asks the sender check about the From address and keeps its verdict', async () => {
    const asked: string[] = [];
    const message = await toInbound(Buffer.from(raw), async (_raw, from) => {
      asked.push(from);
      return false;
    });
    expect(asked).toEqual(['Anna@Example.ch']);
    expect(message.verified).toBe(false);
  });
});

describe('automated mail', () => {
  const mail = (headers: string[], from = 'anna@example.ch') =>
    toInbound(
      Buffer.from(
        [
          `From: <${from}>`,
          'To: support@devguard.ch',
          'Subject: Away',
          ...headers,
          '',
          'I am out of office.',
          '',
        ].join('\r\n')
      ),
      trust(true)
    );

  it('marks out-of-office replies, bulk mail and bounces', async () => {
    expect((await mail(['Auto-Submitted: auto-replied'])).automated).toBe(true);
    expect((await mail(['Precedence: auto_reply'])).automated).toBe(true);
    expect((await mail(['Precedence: bulk'])).automated).toBe(true);
    expect((await mail([], 'MAILER-DAEMON@mx.example.ch')).automated).toBe(
      true
    );
  });

  it('leaves mail a person wrote alone', async () => {
    expect((await mail([])).automated).toBe(false);
    expect((await mail(['Auto-Submitted: no'])).automated).toBe(false);
    expect((await mail(['Precedence: list'])).automated).toBe(false);
  });
});
