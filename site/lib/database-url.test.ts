import { describe, expect, it } from 'vitest';

import { sameDatabase } from './database-url';

describe('sameDatabase', () => {
  it('matches one database however the URL names it', () => {
    expect(
      sameDatabase(
        'postgres://site:secret@DB.example.test/helpdesk?sslmode=require',
        'postgresql://demo@db.example.test:5432/helpdesk'
      )
    ).toBe(true);
  });

  it('tells apart another database, port or server', () => {
    const site = 'postgres://u@db.example.test:5432/helpdesk';
    expect(sameDatabase(site, 'postgres://u@db.example.test:5432/demo')).toBe(
      false
    );
    expect(
      sameDatabase(site, 'postgres://u@db.example.test:5433/helpdesk')
    ).toBe(false);
    expect(sameDatabase(site, 'postgres://u@other.example.test/helpdesk')).toBe(
      false
    );
  });
});
