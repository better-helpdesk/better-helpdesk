import { docsLlms, LLMS_HEADER } from '../../lib/llms';

export const dynamic = 'force-static';

/** Every docs page in one markdown file, for assistants that read the docs whole. */
export async function GET() {
  return new Response(`${LLMS_HEADER}\n\n${await docsLlms.full()}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
