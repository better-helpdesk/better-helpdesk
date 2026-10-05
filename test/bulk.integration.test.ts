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
    const shape = (list: HelpdeskEvent[]) =>
      list.map(e =>
        e.kind === 'conversation.updated'
          ? [
              e.kind,
              Object.keys(e.before).sort(),
              e.before.status,
              e.conversation.status,
              e.agentId !== null,
            ]
          : [e.kind]
      );
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
    expect(res.data.error).toContain(missing);
    expect((await state([a]))[0]?.status).toBe('open');
    expect(await timeline(a)).toEqual([]);
    expect(events).toEqual([]);
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
  });
});
