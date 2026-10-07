import { randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  type AdapterInput,
  createAdapter,
  type DatabaseAdapter,
  type Where,
} from './db/adapter';

/**
 * Checks an adapter against the contract the store relies on, as vitest
 * tests. `adapter` returns it, over a database that has the tables of
 * `helpdeskModel`; `reset` empties them before each test.
 */
export function runAdapterTests({
  name = 'database adapter',
  adapter: open,
  reset,
}: {
  name?: string;
  adapter: () => AdapterInput | DatabaseAdapter;
  reset: () => Promise<void>;
}) {
  const db = (): DatabaseAdapter => {
    const given = open();
    return 'raw' in given ? given : createAdapter(given);
  };
  const contact = (values: Record<string, unknown> = {}) =>
    db().create<{ id: string }>('contact', { name: 'Ada', ...values });
  const names = async (where?: Where) =>
    (
      await db().findMany<{ name: string }>('contact', {
        where,
        orderBy: [{ field: 'name' }],
      })
    ).map(c => c.name);

  describe(`${name}: the adapter contract`, () => {
    beforeEach(reset);

    it('reads back every kind of value as it was written', async () => {
      const seen = new Date('2026-03-04T05:06:07.089Z');
      const custom = { plan: 'pro', seats: 3, nested: { a: [1, 'b', null] } };
      const created = await contact({
        email: 'ada@example.test',
        blocked: true,
        lastSeenAt: seen,
        custom,
      });
      const [row] = await db().findMany<Record<string, unknown>>('contact', {
        where: { field: 'id', value: created.id },
      });
      expect(row).toMatchObject({
        id: created.id,
        name: 'Ada',
        email: 'ada@example.test',
        blocked: true,
        lastSeenAt: seen,
        custom,
        companyId: null,
        locale: null,
      });
      const deal = await db().create<{ id: string }>('deal', {
        title: 'Renewal',
        stage: 'won',
        value: '1234.50',
      });
      const [kept] = await db().findMany<{ value: string }>('deal', {
        where: { field: 'id', value: deal.id },
      });
      expect(Number(kept?.value)).toBe(1234.5);
      await db().create('setting', { key: 'plain', value: 'just text' });
      const [setting] = await db().findMany<{ value: unknown }>('setting', {
        where: { field: 'key', value: 'plain' },
      });
      expect(setting?.value).toBe('just text');
    });

    it('compares, treating NULL as SQL does', async () => {
      await contact({ name: 'a', email: null });
      await contact({ name: 'b', email: 'b@example.test' });
      await contact({ name: 'c', email: 'c@example.test' });
      expect(await names({ field: 'email', value: null })).toEqual(['a']);
      expect(await names({ field: 'email', op: 'ne', value: null })).toEqual([
        'b',
        'c',
      ]);
      expect(
        await names({ field: 'email', op: 'ne', value: 'b@example.test' })
      ).toEqual(['c']);
      expect(
        await names({ field: 'email', op: 'notIn', value: ['c@example.test'] })
      ).toEqual(['b']);
      expect(await names({ field: 'name', op: 'in', value: [] })).toEqual([]);
      expect(await names({ field: 'name', op: 'notIn', value: [] })).toEqual([
        'a',
        'b',
        'c',
      ]);
      expect(await names({ field: 'name', op: 'gt', value: 'a' })).toEqual([
        'b',
        'c',
      ]);
      expect(await names({ field: 'name', op: 'lte', value: 'b' })).toEqual([
        'a',
        'b',
      ]);
      expect(
        await names({
          or: [
            { field: 'name', value: 'a' },
            { not: { field: 'name', op: 'lt', value: 'c' } },
          ],
        })
      ).toEqual(['a', 'c']);
      expect(await names({ and: [] })).toEqual(['a', 'b', 'c']);
      expect(await names({ or: [] })).toEqual([]);
    });

    it('compares identifiers exactly, and other text ignoring case only when asked', async () => {
      // Two users whose ids differ only in case are two people.
      for (const externalUserId of ['user-Ab', 'user-ab']) {
        await db().create('agent', { externalUserId, name: externalUserId });
      }
      const agents = await db().findMany<{ name: string }>('agent', {
        where: { field: 'externalUserId', value: 'user-ab' },
      });
      expect(agents.map(a => a.name)).toEqual(['user-ab']);
      await contact({ name: 'Ab' });
      await contact({ name: 'ab' });
      expect(await names({ field: 'name', value: 'ab' })).toEqual(['ab']);
      expect(
        (await names({ field: 'name', value: 'AB', insensitive: true })).sort()
      ).toEqual(['Ab', 'ab']);
    });

    it('compares and orders times and numbers by value, not as text', async () => {
      const times = [
        '2026-12-31T23:59:59.999Z',
        '2027-01-01T00:00:00.000Z',
        '2026-02-28T09:00:00.000Z',
        '2026-02-28T09:00:00.001Z',
      ].map(t => new Date(t));
      for (const [i, lastSeenAt] of times.entries()) {
        await contact({ name: `t${i}`, lastSeenAt });
      }
      const order = async (direction: 'asc' | 'desc') =>
        (
          await db().findMany<{ name: string }>('contact', {
            orderBy: [{ field: 'lastSeenAt', direction }],
          })
        ).map(c => c.name);
      expect(await order('asc')).toEqual(['t2', 't3', 't0', 't1']);
      expect(await order('desc')).toEqual(['t1', 't0', 't3', 't2']);
      const at = (op: 'lt' | 'lte' | 'gt' | 'gte', value: Date) =>
        names({ field: 'lastSeenAt', op, value });
      expect(await at('lt', times[1] as Date)).toEqual(['t0', 't2', 't3']);
      expect(await at('lte', times[0] as Date)).toEqual(['t0', 't2', 't3']);
      expect(await at('gt', times[0] as Date)).toEqual(['t1']);
      expect(await at('gte', times[3] as Date)).toEqual(['t0', 't1', 't3']);
      // The store treats a one-millisecond range as "the same instant".
      expect(
        await names({
          and: [
            { field: 'lastSeenAt', op: 'gte', value: times[2] },
            {
              field: 'lastSeenAt',
              op: 'lt',
              value: new Date((times[2] as Date).getTime() + 1),
            },
          ],
        })
      ).toEqual(['t2']);
      for (const attempts of [9, 10, 2]) {
        await db().create('job', {
          kind: `k${attempts}`,
          payload: {},
          attempts,
        });
      }
      const jobs = await db().findMany<{ attempts: number }>('job', {
        where: { field: 'attempts', op: 'gt', value: 2 },
        orderBy: [{ field: 'attempts', direction: 'desc' }],
      });
      expect(jobs.map(j => j.attempts)).toEqual([10, 9]);
    });

    it('takes the characters of a search literally', async () => {
      for (const n of ['a_b', 'axb', '50%', '500', '[x]', 'x', 'a!b']) {
        await contact({ name: n });
      }
      const containing = (value: string) =>
        names({ field: 'name', op: 'contains', value });
      expect(await containing('a_b')).toEqual(['a_b']);
      expect(await containing('0%')).toEqual(['50%']);
      expect(await containing('[x]')).toEqual(['[x]']);
      expect(await containing('a!b')).toEqual(['a!b']);
      expect(
        await names({ field: 'name', op: 'startsWith', value: '50' })
      ).toEqual(['50%', '500']);
      expect(
        await names({
          field: 'name',
          op: 'contains',
          value: 'A_B',
          insensitive: true,
        })
      ).toEqual(['a_b']);
    });

    it('orders with NULLs where asked, pages and selects fields', async () => {
      await contact({ name: 'a', locale: 'de' });
      await contact({ name: 'b', locale: null });
      await contact({ name: 'c', locale: 'en' });
      const order = async (
        nulls: 'first' | 'last',
        direction: 'asc' | 'desc'
      ) =>
        (
          await db().findMany<{ name: string }>('contact', {
            orderBy: [{ field: 'locale', direction, nulls }],
          })
        ).map(c => c.name);
      expect(await order('last', 'asc')).toEqual(['a', 'c', 'b']);
      expect(await order('first', 'asc')).toEqual(['b', 'a', 'c']);
      expect(await order('last', 'desc')).toEqual(['c', 'a', 'b']);
      const page = await db().findMany<Record<string, unknown>>('contact', {
        orderBy: [{ field: 'name', direction: 'desc' }],
        limit: 1,
        offset: 1,
        select: ['name'],
      });
      expect(page).toEqual([{ name: 'b' }]);
      expect(await db().count('contact')).toBe(3);
    });

    it('finds rows through another table', async () => {
      const ada = await contact({ name: 'Ada' });
      await contact({ name: 'Bob' });
      await db().create('identity', {
        contactId: ada.id,
        channel: 'email',
        externalId: 'ada@example.test',
        verified: true,
      });
      const holding = {
        model: 'identity' as const,
        field: 'contactId',
        where: { field: 'channel', value: 'email' },
      };
      expect(await names({ field: 'id', op: 'in', select: holding })).toEqual([
        'Ada',
      ]);
      expect(
        await names({ field: 'id', op: 'notIn', select: holding })
      ).toEqual(['Bob']);
    });

    it('counts what it changes, and adds in place', async () => {
      await contact({ name: 'a' });
      await contact({ name: 'b' });
      expect(
        await db().updateMany('contact', undefined, { locale: 'de' })
      ).toBe(2);
      expect(
        await db().updateMany(
          'contact',
          { field: 'name', value: 'a' },
          { locale: 'de' }
        )
      ).toBe(1);
      const job = await db().create<{ id: string }>('job', {
        kind: 'k',
        payload: {},
      });
      await Promise.all(
        Array.from({ length: 50 }, () =>
          db().updateMany(
            'job',
            { field: 'id', value: job.id },
            { attempts: { increment: 1 } }
          )
        )
      );
      const [after] = await db().findMany<{ attempts: number }>('job');
      expect(after?.attempts).toBe(50);
      expect(
        await db().deleteMany('contact', { field: 'name', value: 'a' })
      ).toBe(1);
      expect(await names()).toEqual(['b']);
    });

    it('lets one of two simultaneous compare-and-swap updates win', async () => {
      const job = await db().create<{ id: string }>('job', {
        kind: 'k',
        payload: {},
      });
      const claim = () =>
        db().updateMany(
          'job',
          {
            and: [
              { field: 'id', value: job.id },
              { field: 'lockedUntil', value: null },
            ],
          },
          { lockedUntil: new Date() }
        );
      const won = await Promise.all(Array.from({ length: 10 }, claim));
      expect(won.reduce((a, b) => a + b, 0)).toBe(1);
    });

    it('holds a row read for update until its transaction ends', async () => {
      await db().create('counter', { name: 'race', value: 0 });
      const where = { field: 'name', value: 'race' };
      await Promise.all(
        Array.from({ length: 10 }, () =>
          db().transaction(async tx => {
            const row = await tx.findOne<{ value: number }>('counter', {
              where,
              forUpdate: true,
            });
            await tx.updateMany('counter', where, {
              value: (row?.value ?? 0) + 1,
            });
          })
        )
      );
      const [row] = await db().findMany<{ value: number }>('counter', {
        where,
      });
      expect(row?.value).toBe(10);
    });

    it('keeps all of a transaction, or none of it', async () => {
      await db().transaction(async tx => {
        await tx.create('contact', { name: 'kept' });
      });
      await expect(
        db().transaction(async tx => {
          await tx.create('contact', { name: 'gone' });
          throw new Error('rolled back');
        })
      ).rejects.toThrow('rolled back');
      expect(await names()).toEqual(['kept']);
    });

    it('refuses what the model declares unique', async () => {
      const ada = await contact();
      const bob = await contact({ name: 'Bob' });
      await db().create('setting', { key: 'k', value: 1 });
      await expect(
        db().create('setting', { key: 'k', value: 2 })
      ).rejects.toThrow();
      const identity = (contactId: string, verified: boolean) =>
        db().create('identity', {
          id: randomUUID(),
          contactId,
          channel: 'email',
          externalId: 'shared@example.test',
          verified,
        });
      const carl = await contact({ name: 'Carl' });
      await identity(ada.id, true);
      // Unverified, the same address may sit with another contact; verified, it may not.
      await identity(bob.id, false);
      await expect(identity(carl.id, true)).rejects.toThrow();
    });
  });
}
