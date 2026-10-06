import { describe, expect, it } from 'vitest';

import { parseCsv } from './import';

describe('parseCsv', () => {
  it('reads quoted fields with commas, quotes and line breaks, and CRLF rows', () => {
    const text =
      '﻿Email,Name,Note\r\n' +
      'ada@example.test,"Lovelace, Ada","She said ""hi""\nthen left"\r\n' +
      '\r\n' +
      'bob@example.test,Bob,\n';
    expect(parseCsv(text)).toEqual([
      {
        email: 'ada@example.test',
        name: 'Lovelace, Ada',
        note: 'She said "hi"\nthen left',
      },
      { email: 'bob@example.test', name: 'Bob', note: '' },
    ]);
  });

  it('reads a last row without a line break, and short rows as empty fields', () => {
    expect(parseCsv('a,b\n1')).toEqual([{ a: '1', b: '' }]);
  });
});
