// hCaptcha. The site key is in the hCaptcha dashboard's site settings, the
// secret in the account settings.
import type { CaptchaAdapter } from 'better-helpdesk';

export const captcha: CaptchaAdapter = {
  client: {
    script: 'https://js.hcaptcha.com/1/api.js?render=explicit',
    global: 'hcaptcha',
    siteKey: process.env.HCAPTCHA_SITE_KEY ?? '',
  },
  async verify(token, { ip }) {
    const response = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: process.env.HCAPTCHA_SECRET ?? '',
        response: token,
        sitekey: process.env.HCAPTCHA_SITE_KEY ?? '',
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    if (!response.ok) throw new Error(`hCaptcha answered ${response.status}`);
    return ((await response.json()) as { success?: boolean }).success === true;
  },
};
