import { createElement, Fragment, type ReactNode } from 'react';

/**
 * The message format: plain text with a small Markdown subset, so a body reads
 * fine wherever it lands unrendered (email, search, an AI prompt).
 *
 *   **bold**  _italic_  ++underline++  [text](https://…)  bare https://… links
 *   "- item" and "1. item" lines make lists; a blank line starts a paragraph.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong' | 'em' | 'u'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'p'; lines: Inline[][] }
  | { type: 'ul'; items: Inline[][] }
  // `start`: the source's first number ("15. Oktober" stays 15).
  | { type: 'ol'; items: Inline[][]; start: number };

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*(\d+)[.)]\s+/;

// Earliest match wins; `_` italics need a non-word character on each side so
// snake_case and file_names stay text. The bounds keep a crafted body (a
// thousand unclosed `**`) from making each scan quadratic.
const INLINE =
  /\[([^\]\n]{1,500})\]\(([^)\s]{1,2000})\)|\*\*(?=\S)([\s\S]{1,1000}?)(?<=\S)\*\*|\+\+(?=\S)([\s\S]{1,1000}?)(?<=\S)\+\+|(?<![\p{L}\p{N}_])_(?=\S)([\s\S]{1,1000}?)(?<=\S)_(?![\p{L}\p{N}_])|(https?:\/\/[^\s<>()]{0,2000}[^\s<>().,;:!?'"])/u;

/** `[label](url)` becomes `label (url)`, so the target shows wherever only labels do. */
export function unlabelLinks(text: string) {
  return text.replace(
    /\[([^\]\n]{1,500})\]\(([^)\s]{1,2000})\)/g,
    (_, label: string, href: string) =>
      label.trim() === href ? href : `${label} (${href})`
  );
}

/** Only these open as links; anything else stays text. */
export function safeHref(href: string) {
  return /^(https?:\/\/|mailto:)/i.test(href) ? href : null;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      out.push({ type: 'text', text: rest });
      break;
    }
    if (match.index > 0) {
      out.push({ type: 'text', text: rest.slice(0, match.index) });
    }
    const [whole, label, href, strong, underline, em, url] = match;
    if (label !== undefined && href !== undefined) {
      const safe = safeHref(href);
      out.push(
        safe
          ? { type: 'link', href: safe, children: parseInline(label) }
          : { type: 'text', text: whole }
      );
    } else if (strong !== undefined) {
      out.push({ type: 'strong', children: parseInline(strong) });
    } else if (underline !== undefined) {
      out.push({ type: 'u', children: parseInline(underline) });
    } else if (em !== undefined) {
      out.push({ type: 'em', children: parseInline(em) });
    } else if (url !== undefined) {
      out.push({
        type: 'link',
        href: url,
        children: [{ type: 'text', text: url }],
      });
    }
    rest = rest.slice(match.index + whole.length);
  }
  return out;
}

export function parseRich(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: Inline[][] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'p', lines: paragraph });
    paragraph = [];
  };
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const kind = BULLET.test(line) ? 'ul' : NUMBER.test(line) ? 'ol' : null;
    if (kind) {
      flush();
      const item = parseInline(
        line.replace(kind === 'ul' ? BULLET : NUMBER, '')
      );
      const last = blocks.at(-1);
      if (last?.type === kind) last.items.push(item);
      else if (kind === 'ul') blocks.push({ type: 'ul', items: [item] });
      else {
        const start = Number(NUMBER.exec(line)?.[1] ?? 1);
        blocks.push({ type: 'ol', items: [item], start });
      }
    } else if (line.trim() === '') {
      flush();
    } else {
      paragraph.push(parseInline(line));
    }
  }
  flush();
  return blocks;
}

function inlineText(nodes: Inline[]): string {
  return nodes
    .map(n => (n.type === 'text' ? n.text : inlineText(n.children)))
    .join('');
}

/** The words without the markers, for previews, subjects and notifications. */
export function plainText(text: string) {
  return parseRich(text)
    .map(block =>
      block.type === 'p'
        ? block.lines.map(inlineText).join('\n')
        : block.items
            .map(
              (item, i) =>
                `${block.type === 'ul' ? '•' : `${block.start + i}.`} ${inlineText(item)}`
            )
            .join('\n')
    )
    .join('\n\n');
}

// Rendering -----------------------------------------------------------------

// Children passed as arguments need no keys; this output is derived and never
// reorders, so there is nothing a key would track.
const all = (nodes: ReactNode[]) => createElement(Fragment, null, ...nodes);

/** Where a link really goes, when its label says something else. */
function hostOf(node: Extract<Inline, { type: 'link' }>) {
  if (inlineText(node.children) === node.href) return null;
  try {
    const url = new URL(node.href);
    return url.protocol === 'mailto:' ? url.pathname : url.host;
  } catch {
    return node.href;
  }
}

function inline(nodes: Inline[], hosts: boolean): ReactNode {
  return all(
    nodes.map(node => {
      if (node.type === 'text') return node.text;
      if (node.type === 'link') {
        const host = hosts && hostOf(node);
        const link = createElement(
          'a',
          {
            href: node.href,
            title: node.href,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          inline(node.children, hosts)
        );
        return host ? all([link, ` (${host})`]) : link;
      }
      return createElement(node.type, null, inline(node.children, hosts));
    })
  );
}

/** The parts with `breaks` line breaks between each. */
function joined(parts: ReactNode[], breaks: number) {
  const out: ReactNode[] = [];
  for (const [i, part] of parts.entries()) {
    if (i > 0) for (let b = 0; b < breaks; b++) out.push(createElement('br'));
    out.push(part);
  }
  return all(out);
}

const lines = (rows: Inline[][], hosts: boolean) =>
  joined(
    rows.map(row => inline(row, hosts)),
    1
  );

function compactBlock(block: Block, hosts: boolean) {
  if (block.type === 'p') return lines(block.lines, hosts);
  return lines(
    block.items.map((item, n) => [
      {
        type: 'text' as const,
        text: block.type === 'ul' ? '• ' : `${block.start + n}. `,
      },
      ...item,
    ]),
    hosts
  );
}

function block(b: Block, hosts: boolean) {
  if (b.type === 'p') return createElement('p', null, lines(b.lines, hosts));
  return createElement(
    b.type,
    b.type === 'ol' && b.start !== 1 ? { start: b.start } : null,
    ...b.items.map(item => createElement('li', null, inline(item, hosts)))
  );
}

/**
 * A message body, formatted. `compact` renders inline only (lists as "•"
 * lines), for places that already sit inside a paragraph, such as email.
 * `hosts` shows where each labelled link goes, for text someone else wrote.
 */
export function RichText({
  text,
  compact = false,
  hosts = false,
}: {
  text: string;
  compact?: boolean;
  hosts?: boolean;
}) {
  const blocks = parseRich(text);
  if (compact)
    return joined(
      blocks.map(b => compactBlock(b, hosts)),
      2
    );
  return createElement(
    'div',
    { className: 'rich' },
    ...blocks.map(b => block(b, hosts))
  );
}
