import type { MetadataRoute } from 'next';

import { siteUrl } from '../lib/helpdesk';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl()}/`, changeFrequency: 'weekly', priority: 1 }];
}
