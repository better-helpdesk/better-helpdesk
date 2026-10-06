import type { MetadataRoute } from 'next';

import { siteUrl } from '../lib/site';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl()}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl()}/quickstart/`, changeFrequency: 'monthly' },
    { url: `${siteUrl()}/demo/`, changeFrequency: 'monthly' },
    { url: `${siteUrl()}/privacy/`, changeFrequency: 'yearly' },
  ];
}
