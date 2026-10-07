import type { MetadataRoute } from 'next';

import { siteUrl } from '../lib/site';

export const dynamic = 'force-dynamic';

const DISALLOW = ['/helpdesk/', '/demo/inbox/', '/demo/api/', '/api/'];

// Named, so a crawler that only obeys its own group still reads the rules;
// a named group replaces `*` for that bot, so the rules repeat in it.
const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
];

/** Only the canonical host is crawled; stage and previews are kept out of every index. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  if (new URL(base).hostname !== 'better-helpdesk.com') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: DISALLOW },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
