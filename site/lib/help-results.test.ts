import type { SortedResult } from 'fumadocs-core/search';
import { describe, expect, it } from 'vitest';

import { toHelpResults } from './help-results';

const page = (slug: string, title: string): SortedResult => ({
  id: slug,
  type: 'page',
  content: title,
  breadcrumbs: ['Docs', 'Topics', 'Widget'],
  url: `/docs/${slug}`,
});

describe('toHelpResults', () => {
  it('links a page to its first matching heading, with the heading as excerpt', () => {
    const results = toHelpResults([
      page('widget/add', 'Add the <mark>widget</mark>'),
      {
        id: 'widget/add-0',
        type: 'heading',
        content: 'Theme the <mark>widget</mark>',
        url: '/docs/widget/add#theme-the-widget',
      },
      {
        id: 'widget/add-1',
        type: 'text',
        content: 'Set `--helpdesk-accent` on the <mark>widget</mark>.',
        url: '/docs/widget/add#theme-the-widget',
      },
    ]);
    expect(results).toEqual([
      {
        title: 'Add the widget',
        url: '/docs/widget/add#theme-the-widget',
        excerpt: 'Theme the widget',
      },
    ]);
  });

  it('keeps the page URL when the first match is body text, with the matched text as excerpt', () => {
    const results = toHelpResults([
      page('quickstart', 'Quickstart'),
      {
        id: 'quickstart-3',
        type: 'text',
        content:
          'Run the <mark>migrations</mark>, with `better-helpdesk-migrate`.',
        url: '/docs/quickstart#migrate',
      },
    ]);
    expect(results).toEqual([
      {
        title: 'Quickstart',
        url: '/docs/quickstart',
        excerpt: 'Run the migrations, with better-helpdesk-migrate.',
      },
    ]);
  });

  it('returns a page matched by its title alone without an excerpt, and five pages at most', () => {
    const sorted = Array.from({ length: 7 }, (_, n) =>
      page(`p${n}`, `Page ${n}`)
    );
    const results = toHelpResults(sorted);
    expect(results).toHaveLength(5);
    expect(results[0]).toEqual({ title: 'Page 0', url: '/docs/p0' });
  });
});
