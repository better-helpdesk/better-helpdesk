import { describe, expect, it } from 'vitest';

import { parseInline, parseRich, plainText } from './rich';
import { unlabelLinks } from './ui/rich';

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
