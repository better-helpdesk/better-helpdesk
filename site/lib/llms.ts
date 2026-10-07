import { llms } from 'fumadocs-core/source';

import { DESCRIPTION, NPM, ORIGIN, REPO, SITE_NAME } from './seo';
import { source } from './source';

type Page = ReturnType<typeof source.getPages>[number];

/** A docs page as markdown, with the URL it lives at, for AI crawlers and assistants. */
export async function pageMarkdown(page: Page) {
  const text = await page.data.getText('processed');
  return [
    `# ${page.data.title}`,
    `URL: ${ORIGIN}${page.url}/`,
    page.data.description ?? '',
    text,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export const docsLlms = llms(source, { renderPage: pageMarkdown });

/** The markdown file of a docs page: /docs.md for the introduction, /docs/<path>.md for the rest. */
export const markdownUrl = (url: string) => `${ORIGIN}${url}.md`;

export const LLMS_HEADER = `# ${SITE_NAME}

> ${DESCRIPTION}

${SITE_NAME} is an npm package (\`better-helpdesk\`, MIT) that a host mounts inside its own Next.js app: one route handler, a React component for the agent UI, a widget for customers, and tables in the host's own Postgres, MySQL, SQL Server or SQLite database. It is a library, not a hosted service. In these docs an *agent* is a member of the host's support team, never an AI; AI is an optional adapter whose output a person reviews.

- [Website](${ORIGIN}/): what it is and who it is for
- [Live demo](${ORIGIN}/demo/): write in as a customer and answer as the agent
- [Source on GitHub](${REPO})
- [Package on npm](${NPM})
- [All docs in one file](${ORIGIN}/llms-full.txt)`;
