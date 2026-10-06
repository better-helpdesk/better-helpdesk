// The string tables are not exported from the package, so the docs' UI strings
// page reads them from the repository's source. Run this after changing
// src/ui/i18n.ts; test/docs-reference.test.ts fails until you do.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

export const outFile = fileURLToPath(
  new URL('../app/docs/ui-strings.json', import.meta.url)
);

export function uiStrings() {
  const source = readFileSync(
    new URL('../../src/ui/i18n.ts', import.meta.url),
    'utf8'
  );
  const table = pattern => {
    const body = source.match(pattern)?.[1];
    if (!body) throw new Error(`${pattern} matches nothing in src/ui/i18n.ts`);
    return runInNewContext(`(${body})`);
  };
  return `${JSON.stringify(
    {
      en: table(/^const en = (\{[\s\S]*?^\})/m),
      de: table(/^const de: Record<MessageKey, string> = (\{[\s\S]*?^\})/m),
    },
    null,
    2
  )}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(outFile, uiStrings());
}
