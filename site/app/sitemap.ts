import type { MetadataRoute } from 'next';

import { siteUrl } from '../lib/site';
import { source } from '../lib/source';

export const dynamic = 'force-dynamic';

// No lastmod: the build has no git history to date the pages from, and a
// guessed date is worse than none. Search engines ignore changefreq and priority.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl()}/` },
    { url: `${siteUrl()}/demo/` },
    { url: `${siteUrl()}/privacy/` },
    ...source.getPages().map(page => ({ url: `${siteUrl()}${page.url}/` })),
  ];
}
