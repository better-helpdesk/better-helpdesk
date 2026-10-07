import { describe, expect, it } from 'vitest';

import { databaseOf } from '../bin/url.mjs';

describe('the database a CLI URL names', () => {
  it('reads the family from the scheme', () => {
    expect(databaseOf('postgres://u@db.test/app').family).toBe('postgres');
    expect(databaseOf('postgresql://u@db.test/app').family).toBe('postgres');
    expect(databaseOf('mysql://u@db.test/app').family).toBe('mysql');
    expect(databaseOf('mssql://u@db.test/app').family).toBe('mssql');
    expect(databaseOf('sqlserver://u@db.test/app').family).toBe('mssql');
    expect(databaseOf('oracle://u@db.test/app')).toEqual({
      family: undefined,
      scheme: 'oracle',
    });
  });

  it('keeps a relative file: URL relative', () => {
    expect(databaseOf('file:./data/app.db')).toEqual({
      family: 'sqlite',
      path: './data/app.db',
    });
    expect(databaseOf('file:app.db').path).toBe('app.db');
    expect(databaseOf('file:///srv/app%20data.sqlite').path).toBe(
      '/srv/app data.sqlite'
    );
  });

  it('takes a bare path, a Windows one too', () => {
    expect(databaseOf('./app.sqlite3')).toEqual({
      family: 'sqlite',
      path: './app.sqlite3',
    });
    expect(databaseOf('C:\\data\\app.db')).toEqual({
      family: 'sqlite',
      path: 'C:\\data\\app.db',
    });
    expect(databaseOf('C:\\data\\app.txt').family).toBeUndefined();
  });
});
