// A JSON index your docs build writes: [{ title, url, locale, text }].
import type { HelpResult, Locale } from 'better-helpdesk';

import pages from '@/public/help-index.json';

export const help = {
  async search(query: string, locale: Locale): Promise<HelpResult[]> {
    const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u);
    const terms = words.filter(word => word.length > 2);
    return pages
      .filter(page => page.locale === locale)
      .map(page => {
        const haystack = `${page.title} ${page.text}`.toLowerCase();
        return { page, hits: terms.filter(t => haystack.includes(t)).length };
      })
      .filter(({ hits }) => hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 5)
      .map(({ page }) => ({
        title: page.title,
        url: page.url,
        excerpt: page.text.slice(0, 160),
      }));
  },
};
