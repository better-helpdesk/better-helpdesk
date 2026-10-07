import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';

import { tableName } from '../src/db/kysely';
import { column, helpdeskModel, type ModelName } from '../src/db/model';
import { testAdapter } from './database';

const { builtIn, close } = testAdapter();
afterAll(close);
// The memory adapter has no tables to look at.
const db = builtIn as NonNullable<typeof builtIn>;

/** Columns a database keeps for itself, outside the model. */
const EXTRA: Record<string, string[]> = {
  // Postgres's full-text search.
  'postgres:conversation': ['search'],
  'postgres:message': ['search'],
};

// The migrations and the model describe the same tables; a change to one without the other fails here.
describe.skipIf(!builtIn)('the migrated database', () => {
  it('has every table and column of the model, nullable where the model says', async () => {
    const tables = await db.kysely.introspection.getTables();
    const found = new Map(
      // MySQL reports the database as the schema; its tables carry a prefix instead.
      tables.map(t => [
        t.schema && !t.name.startsWith('helpdesk_')
          ? `${t.schema}.${t.name}`
          : t.name,
        t,
      ])
    );
    for (const model of Object.keys(helpdeskModel) as ModelName[]) {
      const table = found.get(tableName(db.family, model));
      expect(table, model).toBeDefined();
      const fields = helpdeskModel[model].fields as Record<
        string,
        { nullable: boolean }
      >;
      const expected = Object.entries(fields)
        .map(([field, spec]) => `${column(field)}${spec.nullable ? '?' : ''}`)
        .concat(EXTRA[`${db.family}:${model}`] ?? [])
        .sort();
      const actual = (table?.columns ?? [])
        .map(c =>
          (EXTRA[`${db.family}:${model}`] ?? []).includes(c.name)
            ? c.name
            : `${c.name}${c.isNullable ? '?' : ''}`
        )
        .sort();
      expect(actual, model).toEqual(expected);
    }
  });
});

describe('names on a database without schemas', () => {
  it.skipIf(builtIn?.family !== 'sqlite')(
    'gives every index the helpdesk_ prefix, leaving the names of the host free',
    async () => {
      const { rows } = await sql<{ name: string }>`
        select name from sqlite_master
        where type = 'index' and tbl_name like 'helpdesk!_%' escape '!'
          and name not like 'sqlite!_autoindex!_%' escape '!'`.execute(
        db.kysely
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.filter(r => !r.name.startsWith('helpdesk_'))).toEqual([]);
    }
  );
});
