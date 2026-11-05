// Cloudflare Turnstile. The keys come from the Turnstile dashboard; for local
// testing, Cloudflare publishes a site key and secret that always pass.
import type { CaptchaAdapter } from 'better-helpdesk';

export const captcha: CaptchaAdapter = {
  client: {
    script:
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    global: 'turnstile',
    siteKey: process.env.TURNSTILE_SITE_KEY ?? '',
  },
  async verify(token, { ip }) {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET_KEY ?? '',
          response: token,
          ...(ip ? { remoteip: ip } : {}),
        }),
      }
    );
    if (!response.ok) throw new Error(`Turnstile answered ${response.status}`);
    return ((await response.json()) as { success?: boolean }).success === true;
  },
};
