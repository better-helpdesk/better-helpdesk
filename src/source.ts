import type { ConversationContext } from './db/schema';

const NAMES: Record<string, string> = {
  google: 'Google',
  bing: 'Bing',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  twitter: 'X',
  youtube: 'YouTube',
  newsletter: 'Newsletter',
};
const PAID = /^(cpc|ppc|paid|paidsearch|paid_social|display)$/i;

const named = (raw: string) =>
  NAMES[raw.toLowerCase()] ?? raw.charAt(0).toUpperCase() + raw.slice(1);

/** Where a person came from, as sales reads it: "Google Ads · spring", or the referring site. */
export function sourceOf(context: ConversationContext | null | undefined) {
  const utm = context?.utm ?? {};
  if (utm.utm_source) {
    const channel = `${named(utm.utm_source)}${PAID.test(utm.utm_medium ?? '') ? ' Ads' : ''}`;
    return utm.utm_campaign ? `${channel} · ${utm.utm_campaign}` : channel;
  }
  if (!context?.referrer) return null;
  try {
    const host = new URL(context.referrer).hostname.replace(/^www\./, '');
    return named(host.split('.').at(-2) ?? host);
  } catch {
    return null;
  }
}
