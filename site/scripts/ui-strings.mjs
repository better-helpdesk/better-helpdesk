// The string tables are not exported from the package, so the docs' UI strings
// page is built from the repository's source. Runs before `next dev` and `next build`.
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(
  new URL('../../src/ui/i18n.ts', import.meta.url),
  'utf8'
);
const table = pattern => {
  const body = source.match(pattern)?.[1];
  if (!body) throw new Error(`${pattern} matches nothing in src/ui/i18n.ts`);
  return runInNewContext(`(${body})`);
};

writeFileSync(
  new URL('../app/docs/ui-strings.json', import.meta.url),
  `${JSON.stringify({
    en: table(/^const en = (\{[\s\S]*?^\})/m),
    de: table(/^const de: Record<MessageKey, string> = (\{[\s\S]*?^\})/m),
  })}\n`
);
