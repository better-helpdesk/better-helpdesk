import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * The site has no accounts. One agent signs in through HTTP Basic auth with
 * credentials from the environment, which keeps passwords out of the
 * helpdesk schema.
 */
export const AGENT_REALM = 'Better Helpdesk inbox';

const digest = (value: string) => createHash('sha256').update(value).digest();

export function isAgentRequest(headers: Headers): boolean {
  const user = process.env.SITE_AGENT_USER;
  const password = process.env.SITE_AGENT_PASSWORD;
  if (!user || !password) return false;
  const header = headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return false;
  const given = Buffer.from(header.slice(6), 'base64').toString('utf8');
  // Hashing first gives both sides the same length, so the comparison leaks
  // nothing about where they differ.
  return timingSafeEqual(digest(given), digest(`${user}:${password}`));
}
