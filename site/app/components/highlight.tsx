import type { ReactNode } from 'react';

const KEYWORDS = new Set([
  'import',
  'from',
  'export',
  'default',
  'function',
  'return',
  'const',
  'async',
  'await',
  'if',
  'as',
  'null',
  'new',
  'true',
]);
const TOKEN =
  /(\/\/[^\n]*)|('[^']*'|"[^"]*")|(\b[A-Za-z_][\w]*\b)(?=\s*\()|(\b[A-Za-z_][\w]*\b)/g;

/** Enough highlighting for four short samples; no library, no innerHTML. */
export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(code.slice(last, at));
    const [text, comment, string, call, word] = m;
    const cls = comment
      ? 'tk-c'
      : string
        ? 'tk-s'
        : call && !KEYWORDS.has(call)
          ? 'tk-f'
          : (word ?? call) && KEYWORDS.has(word ?? call ?? '')
            ? 'tk-k'
            : null;
    out.push(
      cls ? (
        <span key={at} className={cls}>
          {text}
        </span>
      ) : (
        text
      )
    );
    last = at + text.length;
  }
  out.push(code.slice(last));
  return out;
}
