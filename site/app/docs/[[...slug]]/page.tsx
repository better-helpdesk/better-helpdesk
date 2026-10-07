import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { breadcrumbs, JsonLd, pageMeta, techArticle } from '../../../lib/seo';
import { source } from '../../../lib/source';
import { getMDXComponents } from '../mdx';

type Props = { params: Promise<{ slug?: string[] }> };

const ogImage = (slugs: string[]) =>
  `/og/docs/${[...slugs, 'image.png'].join('/')}`;

export default async function Page({ params }: Props) {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  const MDX = page.data.body;
  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <JsonLd
        schema={[
          techArticle({
            headline: page.data.title,
            description: page.data.description,
            path: `${page.url}/`,
            image: ogImage(page.slugs),
          }),
          breadcrumbs([
            { name: 'Better Helpdesk', path: '/' },
            ...(page.slugs.length > 0
              ? [{ name: 'Docs', path: '/docs/' }]
              : []),
            { name: page.data.title },
          ]),
        ]}
      />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({ a: createRelativeLink(source, page) })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  const meta = pageMeta({
    title: `${page.data.title} · Better Helpdesk docs`,
    description: page.data.description ?? '',
    path: `${page.url}/`,
    type: 'article',
    image: ogImage(page.slugs),
  });
  return {
    ...meta,
    // The page as markdown, for assistants that read it.
    alternates: {
      ...meta.alternates,
      types: { 'text/markdown': `${page.url}.md` },
    },
  };
}
