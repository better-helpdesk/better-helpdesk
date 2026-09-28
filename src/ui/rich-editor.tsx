import {
  type ClipboardEvent,
  type KeyboardEvent,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import type { Translate } from './i18n';
import { type Inline, parseRich, safeHref } from './rich';

type Format = 'bold' | 'italic' | 'underline' | 'ul' | 'ol' | 'link';

const URL_ONLY = /^(https?:\/\/|mailto:)\S+$/i;

// Markdown → editor HTML ------------------------------------------------------

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c
  );

function inlineHtml(nodes: Inline[]): string {
  return nodes
    .map(node => {
      if (node.type === 'text') return escapeHtml(node.text);
      const inner = inlineHtml(node.children);
      if (node.type === 'link') {
        return `<a href="${escapeHtml(node.href)}">${inner}</a>`;
      }
      const tag = node.type === 'strong' ? 'b' : node.type === 'em' ? 'i' : 'u';
      return `<${tag}>${inner}</${tag}>`;
    })
    .join('');
}

/** The message format as the editor's own markup: one div per line. */
export function richToHtml(text: string) {
  return parseRich(text)
    .map(block =>
      block.type === 'p'
        ? block.lines
            .map(line => `<div>${inlineHtml(line) || '<br>'}</div>`)
            .join('')
        : `<${block.type}${block.type === 'ol' && block.start !== 1 ? ` start="${block.start}"` : ''}>${block.items
            .map(item => `<li>${inlineHtml(item)}</li>`)
            .join('')}</${block.type}>`
    )
    .join('<div><br></div>');
}

// Editor or pasted HTML → Markdown -------------------------------------------

/** The editor's markup, or pasted HTML, reduced to the message format. */
export function htmlToRich(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '').replace(/[ \t\r\n]+/g, ' ');
    }
    if (!(node instanceof HTMLElement)) return '';
    const tag = node.tagName;
    if (tag === 'BR') return '\n';
    if (tag === 'SCRIPT' || tag === 'STYLE') return '';
    if (tag === 'UL' || tag === 'OL') {
      const items = [...node.children].filter(c => c.tagName === 'LI');
      return `\n${items
        .map(
          (li, i) =>
            `${tag === 'OL' ? `${((node as HTMLOListElement).start || 1) + i}.` : '-'} ${walk(li).replace(/\n+/g, ' ').trim()}`
        )
        .join('\n')}\n`;
    }
    let text = [...node.childNodes].map(walk).join('');
    if (tag === 'A') {
      const href = safeHref(node.getAttribute('href') ?? '');
      return href && text.trim() ? `[${text.trim()}](${href})` : text;
    }
    const style = node.style;
    const bold =
      tag === 'STRONG' ||
      (tag === 'B' && style.fontWeight !== 'normal') ||
      Number(style.fontWeight) >= 600 ||
      style.fontWeight === 'bold';
    const italic = tag === 'EM' || tag === 'I' || style.fontStyle === 'italic';
    const underline = tag === 'U' || style.textDecoration.includes('underline');
    if (bold || italic || underline) {
      // Per line: the parser splits lines before it reads markers, so a
      // pair spanning a <br> would show as literal ** on both lines.
      text = text
        .split('\n')
        .map(line => {
          const core = line.trim();
          if (!core) return line;
          const at = line.indexOf(core);
          let marked = core;
          if (underline) marked = `++${marked}++`;
          if (italic) marked = `_${marked}_`;
          if (bold) marked = `**${marked}**`;
          return `${line.slice(0, at)}${marked}${line.slice(at + core.length)}`;
        })
        .join('\n');
    }
    // A div is one line (how editors break lines); a p is a paragraph.
    if (/^(P|H[1-6]|BLOCKQUOTE)$/.test(tag)) return `\n\n${text}\n\n`;
    if (/^(DIV|LI|TR)$/.test(tag)) return `\n${text.replace(/\n$/, '')}`;
    return text;
  };
  return walk(doc.body)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// The editor -----------------------------------------------------------------

export type RichEditorHandle = { focus(): void };

/** The selection, which inside a shadow root only the root itself knows. */
function selectionIn(el: HTMLElement) {
  const root = el.getRootNode() as Document & {
    getSelection?: () => Selection | null;
  };
  return root.getSelection?.() ?? document.getSelection();
}

const COMMANDS: Record<Exclude<Format, 'link'>, string> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  ul: 'insertUnorderedList',
  ol: 'insertOrderedList',
};

const ICONS: Record<Format, string> = {
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  italic: 'M19 4h-9M14 20H5M15 4 9 20',
  underline: 'M6 4v6a6 6 0 0 0 12 0V4M4 20h16',
  ul: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  ol: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
};
const SHORTCUT: Partial<Record<Format, string>> = {
  bold: 'b',
  italic: 'i',
  underline: 'u',
  link: 'k',
};

/**
 * A formatted text field whose value is the message format. Formatting shows
 * as it will be sent; the Markdown only exists in `value`.
 */
export function RichEditor({
  value,
  onChange,
  t,
  label,
  placeholder,
  toolbar = true,
  className,
  onKeyDown,
  readOnly = false,
  ref,
}: {
  value: string;
  onChange: (value: string) => void;
  t: Translate;
  label: string;
  placeholder?: string;
  toolbar?: boolean;
  className: string;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  readOnly?: boolean;
  ref?: Ref<RichEditorHandle>;
}) {
  const el = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const saved = useRef<Range | null>(null);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('');

  // Content set from outside (a canned reply, a draft, a reset) replaces what
  // is shown; the editor's own edits come back round unchanged and are skipped.
  useEffect(() => {
    const node = el.current;
    if (!node || value === emitted.current) return;
    node.innerHTML = richToHtml(value);
    emitted.current = value;
  }, [value]);

  const emit = () => {
    const node = el.current;
    if (!node) return;
    const next = htmlToRich(node.innerHTML);
    emitted.current = next;
    onChange(next);
  };

  const focusEnd = () => {
    const node = el.current;
    if (!node) return;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = selectionIn(node);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  useImperativeHandle(ref, () => ({ focus: focusEnd }));

  const openLink = () => {
    const node = el.current;
    const selection = node && selectionIn(node);
    saved.current =
      selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).cloneRange()
        : null;
    setUrl('');
    setLinking(true);
  };

  const applyLink = () => {
    const node = el.current;
    const href = safeHref(url.trim());
    setLinking(false);
    if (!node || !href) return;
    node.focus();
    const selection = selectionIn(node);
    if (saved.current && selection) {
      selection.removeAllRanges();
      selection.addRange(saved.current);
    }
    if (!saved.current || saved.current.collapsed) {
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`
      );
    } else {
      document.execCommand('createLink', false, href);
    }
    emit();
  };

  const format = (f: Format) => {
    if (f === 'link') {
      openLink();
      return;
    }
    el.current?.focus();
    document.execCommand(COMMANDS[f]);
    emit();
  };

  const mac =
    typeof navigator !== 'undefined' && /Mac|iP/.test(navigator.platform);

  return (
    <div className={`rt ${className}`}>
      {/* biome-ignore lint/a11y/useSemanticElements: formatted text needs contentEditable, which a textarea cannot show. */}
      <div
        ref={el}
        className="rt-input"
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        tabIndex={0}
        contentEditable={!readOnly}
        aria-readonly={readOnly || undefined}
        suppressContentEditableWarning
        data-empty={value.trim() === '' || undefined}
        data-placeholder={placeholder}
        onInput={emit}
        onKeyDown={event => {
          const mod = event.metaKey || event.ctrlKey;
          const key = event.key.toLowerCase();
          // The link input lives in the toolbar, so without one ⌘K is not ours.
          const shortcut = (Object.keys(SHORTCUT) as Format[]).find(
            f => SHORTCUT[f] === key && (toolbar || f !== 'link')
          );
          if (mod && !event.shiftKey && !event.altKey && shortcut) {
            event.preventDefault();
            // The host binds ⌘K on the document, where React's root listener
            // also lives, so only an immediate stop keeps it from firing.
            event.nativeEvent.stopImmediatePropagation();
            format(shortcut);
            return;
          }
          onKeyDown?.(event);
        }}
        onPaste={(event: ClipboardEvent<HTMLDivElement>) => {
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain');
          const node = el.current;
          const selection = node && selectionIn(node);
          if (
            URL_ONLY.test(text.trim()) &&
            selection &&
            !selection.isCollapsed &&
            !URL_ONLY.test(selection.toString().trim())
          ) {
            document.execCommand('createLink', false, text.trim());
          } else {
            const html = event.clipboardData.getData('text/html');
            document.execCommand(
              'insertHTML',
              false,
              richToHtml(html ? htmlToRich(html) : text)
            );
          }
          emit();
        }}
      />
      {toolbar &&
        (linking ? (
          <div className="rt-link">
            <input
              type="url"
              aria-label={t('rich.linkUrl')}
              placeholder="https://"
              // biome-ignore lint/a11y/noAutofocus: opened by the link button to type the address.
              autoFocus
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyLink();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setLinking(false);
                  el.current?.focus();
                }
              }}
            />
            <button type="button" onClick={applyLink}>
              {t('rich.addLink')}
            </button>
          </div>
        ) : (
          <div
            className="rt-toolbar"
            role="toolbar"
            aria-label={t('rich.toolbar')}>
            {(Object.keys(ICONS) as Format[]).map(f => {
              const name = t(`rich.${f}`);
              const key = SHORTCUT[f]?.toUpperCase();
              return (
                <button
                  key={f}
                  type="button"
                  aria-label={name}
                  title={key ? `${name} (${mac ? '⌘' : 'Ctrl+'}${key})` : name}
                  // Keep focus, and with it the selection, in the editor.
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => format(f)}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true">
                    <path d={ICONS[f]} />
                  </svg>
                </button>
              );
            })}
          </div>
        ))}
    </div>
  );
}
