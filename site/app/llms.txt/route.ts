import { docsLlms, LLMS_HEADER, markdownUrl } from '../../lib/llms';

export const dynamic = 'force-static';

/** The llms.txt convention: who the site is, then every docs page as a link to its markdown. */
export async function GET() {
  const index = (await docsLlms.index())
    // The tree's own heading is the docs' name; the file has its own at the top.
    .replace(/^# .*\n+/, '')
    .replace(
      /\]\((\/docs[^)]*)\)/g,
      (_, url: string) => `](${markdownUrl(url)})`
    );
  return new Response(`${LLMS_HEADER}\n\n## Docs\n\n${index}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
