import { useEffect, useRef, useState } from 'react';

import type { Translate } from './i18n';
import { isMac, selectionIn } from './rich-editor';

/** Code as written, with a button that copies it. */
export function CodeBlock({ text, t }: { text: string; t: Translate }) {
  const pre = useRef<HTMLPreElement>(null);
  const [status, setStatus] = useState<'copied' | 'select' | null>(null);

  useEffect(() => {
    if (status !== 'copied') return;
    const timer = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    setStatus(null);
    let next: 'copied' | 'select' = 'copied';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard on an insecure page, or permission refused: select the
      // code so a keyboard copy takes exactly it.
      const node = pre.current;
      if (node) selectionIn(node)?.selectAllChildren(node);
      next = 'select';
    }
    // A tick after emptying it, so a second copy is announced again even when
    // the clipboard failed without waiting.
    setTimeout(() => setStatus(next));
  };

  return (
    <div className="code">
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a keyboard has to reach a long line to scroll it. */}
      <pre ref={pre} tabIndex={0}>
        <code>{text}</code>
      </pre>
      <div className="code-bar">
        <span role="status">
          {status === 'copied'
            ? t('rich.copied')
            : status === 'select'
              ? t('rich.copyByHand', { keys: isMac() ? '⌘C' : 'Ctrl+C' })
              : ''}
        </span>
        <button type="button" aria-label={t('rich.copyCode')} onClick={copy}>
          {t('rich.copy')}
        </button>
      </div>
    </div>
  );
}
