import { loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';

// The processed markdown is what /llms.txt, /llms-full.txt and each page's .md serve.
const docs = defineDocs({
  dir: 'content/docs',
  docs: { postprocess: { includeProcessedMarkdown: true } },
});

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
