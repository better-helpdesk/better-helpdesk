import type { HelpResult } from 'better-helpdesk';
import type { SortedResult } from 'fumadocs-core/search';

const MAX_RESULTS = 5;

// Sections carry their MDX source, and the search marks what matched.
const plain = (text: string) =>
  text
    .replace(/<\/?mark>/g, '')
    .replace(/<[^>]*>?/g, ' ')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Fumadocs lists each matching page followed by its matching sections; the
 * widget wants one result per page, linked to its first matching heading.
 */
export function toHelpResults(sorted: SortedResult[]): HelpResult[] {
  const results: HelpResult[] = [];
  let section = false;
  for (const hit of sorted) {
    if (hit.type === 'page') {
      if (results.length === MAX_RESULTS) break;
      results.push({ title: plain(hit.content), url: hit.url });
      section = false;
      continue;
    }
    const page = results.at(-1);
    if (!page || section) continue;
    section = true;
    if (hit.type === 'heading') page.url = hit.url;
    page.excerpt = plain(hit.content);
  }
  return results;
}
