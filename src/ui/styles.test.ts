import { describe, expect, it } from 'vitest';

import { adminCss } from '../admin/styles';
import { widgetCss } from '../widget/styles';

// The defaults block is the first rule; the widget also keeps its dark defaults
// and the redactor's fixed overlay.
const themed = (css: string) =>
  css
    .replace(/^\s*[^{]+\{[^}]*\}/, '')
    .replace(/@media \(prefers-color-scheme: dark\) \{[^}]*\}\s*\}/, '')
    .replace(/\.redact \{[^}]*\}/, '');

describe.each([
  ['admin', adminCss],
  ['widget', widgetCss],
])('%s stylesheet', (_, css) => {
  it('takes every colour from a token', () => {
    expect(
      themed(css).match(
        /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(|(?<![\w-])(?:white|black)(?![\w-])/gi
      )
    ).toBeNull();
  });

  it('derives every radius from the radius token', () => {
    const literal = [...themed(css).matchAll(/radius:([^;]+);/g)]
      .map(([, value = '']) =>
        value
          .replace(/min\(\d+px,[^)]*\)|\b(?:0|50%|999px)(?=\s|$)/g, '')
          .trim()
      )
      .filter(Boolean)
      .filter(value => /\d+px/.test(value));
    expect(literal).toEqual([]);
  });
});
