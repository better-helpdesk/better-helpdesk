import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { parseInline, parseRich, plainText } from './rich';
import { RichText, unlabelLinks } from './ui/rich';

describe('parseInline', () => {
  it('reads bold, italic, underline and links, nested', () => {
    expect(
      parseInline('**bold _both_** ++under++ [site](https://x.ch)')
    ).toEqual([
      {
        type: 'strong',
        children: [
          { type: 'text', text: 'bold ' },
          { type: 'em', children: [{ type: 'text', text: 'both' }] },
        ],
      },
      { type: 'text', text: ' ' },
      { type: 'u', children: [{ type: 'text', text: 'under' }] },
      { type: 'text', text: ' ' },
      {
        type: 'link',
        href: 'https://x.ch',
        children: [{ type: 'text', text: 'site' }],
      },
    ]);
  });

  it('leaves snake_case, unsafe links and trailing punctuation alone', () => {
    expect(parseInline('file_name_here')).toEqual([
      { type: 'text', text: 'file_name_here' },
    ]);
    expect(parseInline('[x](javascript:alert(1))')[0]).toMatchObject({
      type: 'text',
    });
    expect(parseInline('see https://x.ch/a.')).toEqual([
      { type: 'text', text: 'see ' },
      {
        type: 'link',
        href: 'https://x.ch/a',
        children: [{ type: 'text', text: 'https://x.ch/a' }],
      },
      { type: 'text', text: '.' },
    ]);
  });
});

describe('parseRich', () => {
  it('groups lists and paragraphs', () => {
    expect(
      parseRich('Steps:\n1. Open\n2. Export\n\n- one\n- two\nDone').map(
        b => b.type
      )
    ).toEqual(['p', 'ol', 'ul', 'p']);
  });

  it('keeps a fenced block verbatim, blank lines and markers included', () => {
    expect(
      parseRich(
        'It fails:\n```js\nTypeError: **x** is _undefined_\n\n    at f (a.js:1)\n```\n- after'
      )
    ).toEqual([
      { type: 'p', lines: [[{ type: 'text', text: 'It fails:' }]] },
      {
        type: 'pre',
        text: 'TypeError: **x** is _undefined_\n\n    at f (a.js:1)',
      },
      { type: 'ul', items: [[{ type: 'text', text: 'after' }]] },
    ]);
  });

  it('closes a fence only on as many backticks, and runs an unclosed one to the end', () => {
    expect(parseRich('````\n```\ninner\n````')).toEqual([
      { type: 'pre', text: '```\ninner' },
    ]);
    expect(parseRich('```\nlast line')).toEqual([
      { type: 'pre', text: 'last line' },
    ]);
  });
});

describe('plainText', () => {
  it('keeps the number a list starts at', () => {
    expect(plainText('15. Oktober passt uns')).toBe('15. Oktober passt uns');
  });

  it('drops the markers and keeps the words', () => {
    expect(plainText('**Hi** _you_\n- a\n- [b](https://b.ch)')).toBe(
      'Hi you\n\n• a\n• b'
    );
  });

  it('keeps code as written', () => {
    expect(plainText('Run:\n```\nnpm i **x**\n```')).toBe(
      'Run:\n\nnpm i **x**'
    );
  });
});

describe('adversarial input', () => {
  it.each([
    ['unclosed bold', '**a '.repeat(50_000)],
    ['unclosed italics', ' _a'.repeat(70_000)],
    ['unclosed links', '[a](x'.repeat(40_000)],
    ['a long url', `https://${'a'.repeat(1_000_000)}`],
    ['a megabyte of markers', '**_++['.repeat(170_000)],
  ])('parses %s quickly', (_, text) => {
    const start = performance.now();
    plainText(text);
    // CI runners share one host and run far slower than a laptop; a quadratic
    // regression on these sizes takes minutes, so the bound stays loose.
    expect(performance.now() - start).toBeLessThan(15_000);
  });
});

describe('unlabelLinks', () => {
  it('puts every link target next to its label', () => {
    expect(
      unlabelLinks(
        'See [the guide](https://docs.test/a) or [https://x.test](https://x.test).'
      )
    ).toBe('See the guide (https://docs.test/a) or https://x.test.');
  });
});

describe('RichText code blocks', () => {
  const show = (text: string, compact = false) =>
    renderToStaticMarkup(createElement(RichText, { text, compact }));

  it('renders HTML and scripts inside a code block as text', () => {
    expect(
      show(
        '```\n<script>alert(1)</script>\n<img src=x onerror="alert(2)">\n```'
      )
    ).toBe(
      '<div class="rich"><pre><code>&lt;script&gt;alert(1)&lt;/script&gt;\n&lt;img src=x onerror=&quot;alert(2)&quot;&gt;</code></pre></div>'
    );
  });

  it('leaves markers and links inside the block unformatted', () => {
    expect(show('```\n**x** https://a.test\n```')).toBe(
      '<div class="rich"><pre><code>**x** https://a.test</code></pre></div>'
    );
  });

  it('shows the code as lines in compact output', () => {
    expect(show('```\none <two>\nthree\n```', true)).toBe(
      'one &lt;two&gt;<br/>three'
    );
  });

  it('hands each block to the code renderer when given one', () => {
    expect(
      renderToStaticMarkup(
        createElement(RichText, {
          text: 'Hi\n```\na\n```',
          code: text => createElement('figure', null, text),
        })
      )
    ).toBe('<div class="rich"><p>Hi</p><figure>a</figure></div>');
  });
});
