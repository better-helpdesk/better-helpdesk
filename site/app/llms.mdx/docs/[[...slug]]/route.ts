import { notFound } from 'next/navigation';

import { pageMarkdown } from '../../../../lib/llms';
import { ORIGIN } from '../../../../lib/seo';
import { source } from '../../../../lib/source';

export const dynamic = 'force-static';

/** A docs page as markdown; next.config.mjs serves it at the page's URL plus `.md`. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  return new Response(await pageMarkdown(page), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      // Readable by AI tools, but search results should show the HTML page.
      'X-Robots-Tag': 'noindex',
      Link: `<${ORIGIN}${page.url}/>; rel="canonical"`,
    },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
