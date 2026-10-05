import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { HelpdeskEvent } from '../src';
import { createHarness } from './harness';

const events: HelpdeskEvent[] = [];
const h = createHarness({
  async onEvent(event) {
    events.push(event);
  },
});

beforeEach(async () => {
  await h.reset();
  events.length = 0;
  h.addUser('ada');
  h.addUser('agent', { isAgent: true });
});
afterAll(() => h.close());

async function rows<T>(query: ReturnType<typeof sql>) {
  return (await h.support.store.db.execute(query)).rows as T[];
}

async function open(status = 'open') {
  const res = await h.call('POST', 'widget/conversations', {
    user: 'ada',
    body: { inbox: 'support', type: 'bug', body: 'The CSV export fails' },
  });
  expect(res.status).toBe(201);
  const id = res.data.conversation.id as string;
  if (status !== 'open') {
    await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { status },
    });
  }
  return id;
}

const bulk = (
  body: unknown,
  options: { headers?: Record<string, string> } = {}
) =>
  h.call('POST', 'agent/conversations/bulk', {
    user: 'agent',
    body,
    ...options,
  });

const state = (ids: string[]) =>
  rows<{
    id: string;
    status: string;
    priority: string;
    assignee_id: string | null;
    tags: string[];
    resolved_at: Date | null;
  }>(
    sql`SELECT id, status, priority, assignee_id, tags, resolved_at FROM helpdesk.conversation WHERE id IN ${ids} ORDER BY id`
  );

const timeline = (id: string) =>
  rows<{ kind: string; data: unknown }>(
    sql`SELECT kind, data FROM helpdesk.conversation_event WHERE conversation_id = ${id}::uuid ORDER BY created_at, kind`
  );

describe('bulk conversation changes', () => {
  it('resolves a mixed-status batch with the same rows and events as resolving each one', async () => {
    const pairs = [];
    for (const status of ['open', 'pending', 'resolved']) {
      pairs.push({ bulk: await open(status), single: await open(status) });
    }
    const resolvedBefore = await state([pairs[2]?.bulk ?? '']);
    events.length = 0;

    const res = await bulk({
      ids: pairs.map(p => p.bulk),
      status: 'resolved',
    });
    expect(res.status).toBe(200);
    const bulkEvents = events.splice(0);
    for (const { single } of pairs) {
      await h.call('PATCH', `agent/conversations/${single}`, {
        user: 'agent',
        body: { status: 'resolved' },
      });
    }

    expect(res.data).toEqual({ ok: true });
    expect((await state(pairs.map(p => p.bulk))).map(r => r.status)).toEqual([
      'resolved',
      'resolved',
      'resolved',
    ]);
    expect((await state([pairs[2]?.bulk ?? '']))[0]?.resolved_at).toEqual(
      resolvedBefore[0]?.resolved_at
    );
    for (const { bulk: b, single } of pairs) {
      expect(await timeline(b)).toEqual(await timeline(single));
    }
    // A batch goes in id order, so only the set of events must match.
    const shape = (list: HelpdeskEvent[]) =>
      list
        .map(e =>
          e.kind === 'conversation.updated'
            ? [
                e.kind,
                Object.keys(e.before).sort(),
                e.before.status,
                e.conversation.status,
                e.agentId !== null,
              ]
            : [e.kind]
        )
        .map(e => JSON.stringify(e))
        .sort();
    expect(bulkEvents).toHaveLength(2);
    expect(shape(bulkEvents)).toEqual(shape(events));
  });

  it('assigns, sets the priority and adds a tag to every conversation, keeping their own tags', async () => {
    const a = await open();
    const b = await open();
    await h.call('PATCH', `agent/conversations/${a}`, {
      user: 'agent',
      body: { tags: ['vip'] },
    });
    const agent = await rows<{ id: string }>(
      sql`SELECT id FROM helpdesk.agent`
    );
    const assigneeId = agent[0]?.id;

    const res = await bulk({
      ids: [a, b],
      assigneeId,
      priority: 'high',
      addTag: 'Outage',
    });

    expect(res.status).toBe(200);
    const after = await state([a, b]);
    expect(after.map(r => [r.id, r.assignee_id, r.priority, r.tags])).toEqual(
      [
        [a, assigneeId, 'high', ['vip', 'outage']],
        [b, assigneeId, 'high', ['outage']],
      ].sort((x, y) => String(x[0]).localeCompare(String(y[0])))
    );
    expect((await timeline(b)).map(e => e.kind).sort()).toEqual([
      'assigneeId',
      'priority',
      'tags',
    ]);
  });

  it('changes nothing when one id is unknown, and names it', async () => {
    const a = await open();
    const missing = randomUUID();
    events.length = 0;

    const res = await bulk({ ids: [a, missing], status: 'resolved' });

    expect(res.status).toBe(404);
    expect(res.data.ids).toEqual([missing]);
    expect((await state([a]))[0]?.status).toBe('open');
    expect(await timeline(a)).toEqual([]);
    expect(events).toEqual([]);
  });

  it('adds a tag to none when one conversation has no room for it, and names that one', async () => {
    const full = await open();
    const other = await open();
    const fifty = Array.from({ length: 50 }, (_, i) => `t${i}`);
    await h.call('PATCH', `agent/conversations/${full}`, {
      user: 'agent',
      body: { tags: fifty },
    });

    const res = await bulk({ ids: [other, full], addTag: 'outage' });

    expect(res.status).toBe(400);
    expect(res.data.ids).toEqual([full]);
    expect((await state([other]))[0]?.tags).toEqual([]);
    expect(await timeline(other)).toEqual([]);
  });

  it('refuses more than 100 ids, ids that are not uuids and an unknown assignee', async () => {
    const ids = Array.from({ length: 101 }, () => randomUUID());
    expect((await bulk({ ids, status: 'resolved' })).status).toBe(400);
    expect((await bulk({ ids: ['1'], status: 'resolved' })).status).toBe(400);
    expect((await bulk({ ids: [], status: 'resolved' })).status).toBe(400);
    const a = await open();
    expect((await bulk({ ids: [a], assigneeId: randomUUID() })).status).toBe(
      400
    );
  });

  it('is for agents on this origin only', async () => {
    const a = await open();
    const asCustomer = await h.call('POST', 'agent/conversations/bulk', {
      user: 'ada',
      body: { ids: [a], status: 'resolved' },
    });
    expect(asCustomer.status).toBe(403);
    expect(
      (
        await bulk(
          { ids: [a], status: 'resolved' },
          { headers: { origin: 'https://evil.test' } }
        )
      ).status
    ).toBe(403);
    expect((await state([a]))[0]?.status).toBe('open');
  });

  it('runs overlapping batches in any order without deadlocking', async () => {
    const a = await open();
    const b = await open();
    const results = await Promise.all([
      bulk({ ids: [a, b], priority: 'high' }),
      bulk({ ids: [b, a], priority: 'low' }),
      bulk({ ids: [a, b], priority: 'urgent' }),
      bulk({ ids: [b, a], priority: 'normal' }),
    ]);
    expect(results.map(r => r.status)).toEqual([200, 200, 200, 200]);

    // The batches lock both rows, so they apply one after another: both rows
    // end on the same priority and saw the same changes.
    const after = await state([a, b]);
    const final = after[0]?.priority;
    expect(['high', 'low', 'urgent', 'normal']).toContain(final);
    expect(after[1]?.priority).toBe(final);
    const changes = async (id: string) =>
      (await timeline(id))
        .map(e => {
          expect(e.kind).toBe('priority');
          return e.data as { from: string; to: string };
        })
        .map(d => `${d.from}>${d.to}`)
        .sort();
    const changesA = await changes(a);
    expect(changesA).toEqual(await changes(b));
    // Chained from 'normal', every priority is entered as often as it is
    // left, except that the chain leaves 'normal' and ends on `final`.
    const balance = new Map<string, number>();
    for (const change of changesA) {
      const [from = '', to = ''] = change.split('>');
      balance.set(from, (balance.get(from) ?? 0) - 1);
      balance.set(to, (balance.get(to) ?? 0) + 1);
    }
    for (const p of ['high', 'low', 'urgent', 'normal']) {
      expect(balance.get(p) ?? 0).toBe(
        (p === final ? 1 : 0) - (p === 'normal' ? 1 : 0)
      );
    }
  });

  it('reopens resolved conversations from concurrent batches like a single change does', async () => {
    const pairs = [];
    for (let i = 0; i < 8; i++) {
      pairs.push({
        bulk: await open('resolved'),
        single: await open('resolved'),
      });
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>(resolve => {
      timer = setTimeout(() => resolve('timeout'), 8_000);
    });
    const results = await Promise.race([
      Promise.all(pairs.map(p => bulk({ ids: [p.bulk], status: 'open' }))),
      timeout,
    ]);
    clearTimeout(timer);
    expect(results).not.toBe('timeout');
    expect(results !== 'timeout' && results.map(r => r.status)).toEqual(
      pairs.map(() => 200)
    );
    for (const { single } of pairs) {
      await h.call('PATCH', `agent/conversations/${single}`, {
        user: 'agent',
        body: { status: 'open' },
      });
    }

    const waiting = await rows<{
      id: string;
      status: string;
      waiting_since: Date | null;
      last_at: Date;
      last_author: string;
    }>(
      sql`SELECT c.id, c.status, c.waiting_since,
            date_trunc('milliseconds', m.created_at) AS last_at, m.author_type AS last_author
          FROM helpdesk.conversation c
          JOIN LATERAL (SELECT created_at, author_type FROM helpdesk.message
            WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) m ON true
          WHERE c.id IN ${pairs.map(p => p.bulk)}`
    );
    expect(waiting).toHaveLength(pairs.length);
    // waitingSince passes through a JS Date, which keeps milliseconds.
    for (const row of waiting) {
      expect(row.status).toBe('open');
      expect(row.last_author).toBe('contact');
      expect(row.waiting_since).toEqual(row.last_at);
    }
    for (const { bulk: b, single } of pairs) {
      expect(await timeline(b)).toEqual(await timeline(single));
    }
  }, 15_000);
});
