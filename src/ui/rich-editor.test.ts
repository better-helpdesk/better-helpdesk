// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { htmlToRich, looksLikeCode, richToHtml } from './rich-editor';

describe('htmlToRich', () => {
  it('keeps bold, italic, underline, lists and links, and nothing else', () => {
    expect(
      htmlToRich(
        '<p><b>Bold</b> <i>it</i> <u>under</u> <span style="color:red">plain</span> <a href="https://x.ch">site</a></p><ul><li>one</li><li>two</li></ul><script>x()</script>'
      )
    ).toBe(
      '**Bold** _it_ ++under++ plain [site](https://x.ch)\n\n- one\n- two'
    );
  });

  it('ignores the normal-weight bold wrapper Google Docs pastes', () => {
    expect(
      htmlToRich('<b style="font-weight:normal"><span>Hello</span></b>')
    ).toBe('Hello');
  });

  it('marks each line of a bold run that spans a line break', () => {
    expect(htmlToRich('<b>first<br>second</b>')).toBe('**first**\n**second**');
  });

  it('reads the editor’s lines: text, then one div per line', () => {
    expect(
      htmlToRich(
        'Hi <b>there</b><div>second</div><div><br></div><div>third</div>'
      )
    ).toBe('Hi **there**\nsecond\n\nthird');
  });
});

describe('code blocks in the editor', () => {
  it('reads pasted <pre> as a code block, spacing and blank lines kept', () => {
    expect(
      htmlToRich(
        '<p>It broke:</p><pre>TypeError: x is undefined\n    at f (a.js:1:2)\n\n\n    at g (**b**.js:3:4)</pre>'
      )
    ).toBe(
      'It broke:\n\n```\nTypeError: x is undefined\n    at f (a.js:1:2)\n\n\n    at g (**b**.js:3:4)\n```'
    );
  });

  it('reads an editor’s monospace lines as one code block', () => {
    expect(
      htmlToRich(
        '<div style="font-family: Menlo, monospace; white-space: pre;"><div><span>const a = 1;</span></div><div><br></div><div><span>  return a;</span></div></div>'
      )
    ).toBe('```\nconst a = 1;\n\n  return a;\n```');
  });

  it('fences code that contains backticks with more of them', () => {
    expect(htmlToRich('<pre>```\nx\n```</pre>')).toBe(
      '````\n```\nx\n```\n````'
    );
  });

  it('round-trips a code block through the editor', () => {
    const text =
      'Run this:\n\n```\nnpm i **pkg**\n\n  <b>not html</b>\n```\n\nThanks';
    expect(htmlToRich(richToHtml(text))).toBe(text);
  });

  it('escapes the code it shows', () => {
    expect(richToHtml('```\n<script>alert(1)</script>\n```')).toBe(
      '<pre>\n&lt;script&gt;alert(1)&lt;/script&gt;</pre><div><br></div>'
    );
  });
});

describe('looksLikeCode', () => {
  it.each([
    'Error: x\n    at a (a.js:1:1)\n    at b (b.js:2:2)',
    'Traceback:\n  File "a.py", line 1\n    boom()',
    '{\n\t"a": 1\n}',
  ])('takes indented lines for code: %j', text => {
    expect(looksLikeCode(text)).toBe(true);
  });

  it.each([
    'Hello,\nthe export fails\nthanks',
    'Steps:\n  - open\n  - export',
    'Steps:\n  1. open\n  2. export',
    'only\n    two lines',
  ])('leaves prose and lists as text: %j', text => {
    expect(looksLikeCode(text)).toBe(false);
  });
});

describe('richToHtml', () => {
  it('round-trips the message format through the editor', () => {
    const text =
      'Where is the **export**?\nSee [docs](https://d.ch)\n\n- _CSV_\n- ++Word++\n\n1. one\n2. two';
    expect(htmlToRich(richToHtml(text))).toBe(text);
  });

  it('keeps a list numbered from where the source starts', () => {
    const text = '15. Oktober passt uns\n16. oder der Tag danach';
    expect(htmlToRich(richToHtml(text))).toBe(text);
  });

  it('escapes what it shows', () => {
    expect(richToHtml('<img src=x>')).toBe('<div>&lt;img src=x&gt;</div>');
  });
});

describe('RichText', () => {
  it('shows where a labelled link goes when asked', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { RichText } = await import('./rich');
    const text = '[Your invoice](https://evil.example/x) https://ok.ch';
    const shown = renderToStaticMarkup(
      createElement(RichText, { text, hosts: true })
    );
    expect(shown).toContain('Your invoice</a> (evil.example)');
    expect(shown).not.toContain('(ok.ch)');
    expect(
      renderToStaticMarkup(createElement(RichText, { text }))
    ).not.toContain('(evil.example)');
  });
});
