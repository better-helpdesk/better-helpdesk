import { generateOGImage } from 'fumadocs-ui/og';
import { notFound } from 'next/navigation';

import { source } from '../../../../lib/source';

export const dynamic = 'force-static';

/** The social card of a docs page, rendered at build time; the last slug segment is `image.png`. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const page = source.getPage((await params).slug.slice(0, -1));
  if (!page) notFound();
  return generateOGImage({
    title: page.data.title,
    description: page.data.description,
    site: 'Better Helpdesk',
    primaryColor: 'rgba(154, 217, 184, 0.3)',
    primaryTextColor: '#9ad9b8',
  });
}

export function generateStaticParams() {
  return source
    .getPages()
    .map(page => ({ slug: [...page.slugs, 'image.png'] }));
}
