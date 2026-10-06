import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

// Biome formats every member of an exported object type at two spaces, and
// anything nested deeper, so the type's own fields are the two-space lines.
function fields(source: string, type: string) {
  const body = source.match(
    new RegExp(`^export type ${type} = \\{\\n([\\s\\S]*?)^\\};`, 'm')
  )?.[1];
  if (!body) throw new Error(`export type ${type} not found in src/config.ts`);
  return [...body.matchAll(/^ {2}(\w+)\??[:(]/gm)].map(m => m[1]);
}

// The TypeTable keys between two headings of a reference page.
function documented(page: string, from: string, to: string) {
  const mdx = read(`site/content/docs/reference/${page}`);
  const start = mdx.indexOf(`\n${from}\n`);
  const end = mdx.indexOf(`\n${to}\n`, start);
  if (start < 0 || end < 0) throw new Error(`${from} or ${to} not in ${page}`);
  return new Set(
    [...mdx.slice(start, end).matchAll(/^ {4}(\w+): \{/gm)].map(m => m[1])
  );
}

describe('the reference documents every field', () => {
  const config = read('src/config.ts');

  it.each([
    ['HelpdeskConfig', 'configuration.mdx', '## Required', '## Identity'],
    ['InboxConfig', 'inboxes.mdx', '## InboxConfig', '## BusinessHours'],
  ])('%s in %s', (type, page, from, to) => {
    const names = fields(config, type);
    expect(names.length).toBeGreaterThan(0);
    const listed = documented(page, from, to);
    const missing = names.filter(name => !listed.has(name));
    expect(
      missing,
      `${type} fields missing from site/content/docs/reference/${page}: ${missing.join(', ')}`
    ).toEqual([]);
  });
});
