import type { Metadata } from 'next';

/** Fixed rather than SITE_URL: the build has no environment, and reading it per request would make every page dynamic. */
export const ORIGIN = 'https://better-helpdesk.com';
export const SITE_NAME = 'Better Helpdesk';
export const REPO = 'https://github.com/better-helpdesk/better-helpdesk';
export const NPM = 'https://www.npmjs.com/package/better-helpdesk';
export const DESCRIPTION =
  'An open-source support inbox, ticketing and lightweight CRM you install from npm. It runs in your Next.js app, on your database, behind your login.';

/** The site's social card; docs pages render their own. */
const CARD = {
  url: '/og.png',
  alt: 'Better Helpdesk: your helpdesk, inside your app',
};

const ORG_ID = `${ORIGIN}/#organization`;
const WEBSITE_ID = `${ORIGIN}/#website`;

/**
 * A page's own title, description, canonical URL and social cards. Set per
 * page, never in a layout, where every child would inherit the canonical.
 */
export function pageMeta({
  title,
  description,
  path,
  type = 'website',
  image,
}: {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  image?: string;
}): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      type,
      images: [
        image
          ? { url: image, width: 1200, height: 630, alt: title }
          : { ...CARD, width: 1200, height: 630 },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image ?? CARD.url],
    },
  };
}

type Schema = Record<string, unknown>;

/** Structured data for search engines and AI crawlers; `<` is escaped so no text can close the script. */
export function JsonLd({ schema }: { schema: Schema | Schema[] }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON with `<` escaped, built from our own constants
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(
          Array.isArray(schema)
            ? { '@context': 'https://schema.org', '@graph': schema }
            : { '@context': 'https://schema.org', ...schema }
        ).replace(/</g, '\\u003c'),
      }}
    />
  );
}

export const organization = (): Schema => ({
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE_NAME,
  url: `${ORIGIN}/`,
  logo: `${ORIGIN}/apple-icon/`,
  sameAs: [REPO, NPM],
  founder: {
    '@type': 'Person',
    name: 'Angelo Dini',
    sameAs: 'https://github.com/FinalAngel',
  },
});

export const website = (): Schema => ({
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: SITE_NAME,
  url: `${ORIGIN}/`,
  description: DESCRIPTION,
  inLanguage: 'en',
  publisher: { '@id': ORG_ID },
});

export const software = (): Schema => ({
  '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
  name: SITE_NAME,
  description: DESCRIPTION,
  url: `${ORIGIN}/`,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Node.js',
  programmingLanguage: 'TypeScript',
  codeRepository: REPO,
  license: 'https://opensource.org/licenses/MIT',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@id': ORG_ID },
});

export const faqPage = (items: { question: string; answer: string }[]) => ({
  '@type': 'FAQPage',
  mainEntity: items.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
});

export const techArticle = ({
  headline,
  description,
  path,
  image,
}: {
  headline: string;
  description?: string;
  path: string;
  image: string;
}): Schema => ({
  '@type': 'TechArticle',
  headline,
  description,
  url: `${ORIGIN}${path}`,
  image: `${ORIGIN}${image}`,
  inLanguage: 'en',
  author: { '@id': ORG_ID },
  publisher: { '@id': ORG_ID },
  isPartOf: { '@id': WEBSITE_ID },
});

export const breadcrumbs = (crumbs: { name: string; path?: string }[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((crumb, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: crumb.name,
    ...(crumb.path && { item: `${ORIGIN}${crumb.path}` }),
  })),
});
