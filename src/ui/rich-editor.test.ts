// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { htmlToRich, richToHtml } from './rich-editor';

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
