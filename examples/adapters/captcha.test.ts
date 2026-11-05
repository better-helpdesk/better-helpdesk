import { afterEach, expect, test, vi } from 'vitest';

import { captcha as hcaptcha } from './captcha-hcaptcha';
import { captcha as recaptcha } from './captcha-recaptcha';
import { captcha as turnstile } from './captcha-turnstile';

afterEach(() => vi.unstubAllGlobals());

function provider(body: unknown, status = 200) {
  const fetch = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const cases = [
  [
    'Turnstile',
    turnstile,
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    'TURNSTILE_SECRET_KEY',
  ],
  [
    'hCaptcha',
    hcaptcha,
    'https://api.hcaptcha.com/siteverify',
    'HCAPTCHA_SECRET',
  ],
  [
    'reCAPTCHA',
    recaptcha,
    'https://www.google.com/recaptcha/api/siteverify',
    'RECAPTCHA_SECRET_KEY',
  ],
] as const;

test.each(cases)(
  '%s gets the token, the secret and the address as a form post',
  async (_, adapter, url, secret) => {
    process.env[secret] = 'secret-value';
    const fetch = provider({ success: true });
    expect(await adapter.verify('token-1', { ip: '203.0.113.7' })).toBe(true);
    const [called, init] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(called).toBe(url);
    const form = init.body as URLSearchParams;
    expect([
      init.method,
      form.get('secret'),
      form.get('response'),
      form.get('remoteip'),
    ]).toEqual(['POST', 'secret-value', 'token-1', '203.0.113.7']);
  }
);

test.each(cases)(
  '%s refuses what the provider refuses, and throws when it cannot answer',
  async (_, adapter) => {
    provider({ success: false, 'error-codes': ['invalid-input-response'] });
    expect(await adapter.verify('token-1', { ip: null })).toBe(false);
    provider({}, 503);
    await expect(adapter.verify('token-1', { ip: null })).rejects.toThrow(
      '503'
    );
  }
);
