import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { postgresBaseline } from './postgres-baseline';

describe('the Postgres baseline', () => {
  it('is the drizzle-kit migrations, unchanged and in order', async () => {
    const journal = JSON.parse(
      await readFile(
        new URL('../../migrations/meta/_journal.json', import.meta.url),
        'utf8'
      )
    ) as { entries: { tag: string; when: number }[] };
    expect(postgresBaseline.map(m => [m.tag, m.when])).toEqual(
      journal.entries.map(e => [e.tag, e.when])
    );
    for (const migration of postgresBaseline) {
      const file = await readFile(
        new URL(`../../migrations/${migration.tag}.sql`, import.meta.url),
        'utf8'
      );
      expect(migration.sql).toBe(file);
    }
  });
});
