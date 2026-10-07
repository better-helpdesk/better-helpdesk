import { createHash } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { postgresAdapter } from '../src/db/kysely';
import { migrate } from '../src/db/migrate';
import { postgresBaseline } from '../src/db/postgres-baseline';
import { createStore } from '../src/db/store';
import { testFamily } from './database';
import { testDatabaseUrl } from './database-url';

// An install that drizzle migrated before the adapters existed, with data.
describe.skipIf(testFamily !== 'postgres')(
  'upgrading a Postgres install from before the adapters',
  () => {
    const url = new URL(testDatabaseUrl());
    url.pathname = `${url.pathname}_upgrade`;
    const admin = new URL(url);
    admin.pathname = '/postgres';
    let pool: pg.Pool;

    beforeAll(async () => {
      const client = new pg.Client({ connectionString: admin.toString() });
      await client.connect();
      const name = url.pathname.slice(1);
      await client.query(`DROP DATABASE IF EXISTS "${name}"`);
      await client.query(`CREATE DATABASE "${name}"`);
      await client.end();
      pool = new pg.Pool({ connectionString: url.toString(), max: 2 });
      await pool.query(
        'CREATE SCHEMA helpdesk; CREATE TABLE helpdesk.__migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)'
      );
      for (const m of postgresBaseline) {
        for (const statement of m.sql.split('--> statement-breakpoint')) {
          if (statement.trim()) await pool.query(statement);
        }
        await pool.query(
          'INSERT INTO helpdesk.__migrations (hash, created_at) VALUES ($1, $2)',
          [createHash('sha256').update(m.sql).digest('hex'), m.when]
        );
      }
      await pool.query(`
      INSERT INTO helpdesk.company (id, name, tags) VALUES ('00000000-0000-4000-8000-000000000001', 'Acme', '{key,trial}');
      INSERT INTO helpdesk.contact (id, name, tags) VALUES ('00000000-0000-4000-8000-000000000002', 'Ada', '{vip}');
      INSERT INTO helpdesk.conversation (id, inbox, type, contact_id, tags)
        VALUES ('00000000-0000-4000-8000-000000000003', 'support', 'question',
          '00000000-0000-4000-8000-000000000002', '{urgent,billing}');`);
    });

    afterAll(() => pool?.end());

    it('keeps the old migrations, moves the tags in their order, and continues the references', async () => {
      const adapter = postgresAdapter({ pool });
      expect(await migrate(adapter)).toEqual([
        '0000_baseline',
        '0001_tags_and_counter',
      ]);
      const { rows } = await pool.query(
        'SELECT count(*)::int AS n FROM helpdesk.__migrations'
      );
      expect(rows[0].n).toBe(postgresBaseline.length);

      const store = createStore(adapter);
      const old = await store.getConversation(
        '00000000-0000-4000-8000-000000000003'
      );
      expect(old?.tags).toEqual(['urgent', 'billing']);
      expect(old?.number).toBe(1000);
      expect(
        (await store.getContact('00000000-0000-4000-8000-000000000002'))?.tags
      ).toEqual(['vip']);
      expect(
        (await store.getCompany('00000000-0000-4000-8000-000000000001'))?.tags
      ).toEqual(['key', 'trial']);

      const { conversation } = await store.createConversation(
        {
          inbox: 'support',
          type: 'question',
          contactId: '00000000-0000-4000-8000-000000000002',
        },
        {
          body: 'Hello',
          contactId: '00000000-0000-4000-8000-000000000002',
          verified: true,
        }
      );
      expect(conversation.number).toBe(1001);
      expect(await migrate(adapter)).toEqual([]);
    });
  }
);
