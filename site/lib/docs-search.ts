import { createFromSource } from 'fumadocs-core/search/server';

import { source } from './source';

/** The docs' search index: the docs dialog queries it over /api/search, the widget through `help`. */
export const docsSearch = createFromSource(source, { language: 'english' });
