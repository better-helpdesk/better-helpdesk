import type { MetadataRoute } from 'next';

import { siteUrl } from '../lib/helpdesk';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/helpdesk/' },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
