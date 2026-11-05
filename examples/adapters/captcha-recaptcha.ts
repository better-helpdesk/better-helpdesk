// Google reCAPTCHA v2 ("I'm not a robot"). Create the keys as a v2 checkbox
// key in the reCAPTCHA admin console; v3 keys render nothing to click.
import type { CaptchaAdapter } from 'better-helpdesk';

export const captcha: CaptchaAdapter = {
  client: {
    script: 'https://www.google.com/recaptcha/api.js?render=explicit',
    global: 'grecaptcha',
    siteKey: process.env.RECAPTCHA_SITE_KEY ?? '',
  },
  async verify(token, { ip }) {
    const response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        body: new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY ?? '',
          response: token,
          ...(ip ? { remoteip: ip } : {}),
        }),
      }
    );
    if (!response.ok) throw new Error(`reCAPTCHA answered ${response.status}`);
    return ((await response.json()) as { success?: boolean }).success === true;
  },
};
