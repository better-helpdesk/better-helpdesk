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

  it('reads a quote inside an unquoted field as a character', () => {
    expect(parseCsv('email,name\nx@a.test,5" monitor\ny@a.test,Y\n')).toEqual([
      { email: 'x@a.test', name: '5" monitor' },
      { email: 'y@a.test', name: 'Y' },
    ]);
  });

  it('refuses an unterminated quote and text after a closing quote, with the line', () => {
    expect(() => parseCsv('a,b\n1,2\n"open,3\n4,5\n')).toThrow(
      'CSV line 3: a quote is never closed'
    );
    expect(() => parseCsv('a,b\n"x"y,2\n')).toThrow(
      'CSV line 2: text after a closing quote'
    );
  });

  it('reads an empty file and a header alone as no rows', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('email,name\n')).toEqual([]);
  });
});
