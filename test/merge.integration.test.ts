import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

const h = createHarness();

beforeEach(() => h.reset());
afterAll(() => h.close());

async function rows<T>(query: ReturnType<typeof sql>) {
  return (await h.support.store.db.execute(query)).rows as T[];
}

async function open(user: string, body: string) {
  const res = await h.call('POST', 'widget/conversations', {
    user,
    body: { inbox: 'support', type: 'question', subject: 'Export', body },
  });
  expect(res.status).toBe(201);
  return res.data.conversation as { id: string; reference: string };
}

const merge = (sourceId: string, targetId: string) =>
  h.call('POST', `agent/conversations/${sourceId}/merge`, {
    user: 'agent',
    body: { targetId },
  });

describe('merging conversations', () => {
  beforeEach(() => {
    h.addUser('carol', { email: 'carol@example.test' });
    h.addUser('dan', { email: 'dan@example.test' });
    h.addUser('agent', { isAgent: true });
  });

  it('moves messages, attachments and the customer onto the target and resolves the source', async () => {
    const source = await open('carol', 'From the widget');
    const target = await open('dan', 'By email');
    const [message] = await rows<{ id: string }>(
      sql`SELECT id FROM helpdesk.message WHERE conversation_id = ${source.id}::uuid`
    );
    await h.support.store.db.execute(sql`
      INSERT INTO helpdesk.attachment (conversation_id, message_id, key, filename, content_type, size, uploaded)
      VALUES (${source.id}::uuid, ${message?.id}::uuid, 'k', 'log.txt', 'text/plain', 3, true)`);

    expect((await merge(source.id, target.id)).status).toBe(200);

    expect(
      await rows(
        sql`SELECT body FROM helpdesk.message WHERE conversation_id = ${target.id}::uuid ORDER BY created_at`
      )
    ).toEqual([{ body: 'From the widget' }, { body: 'By email' }]);
    expect(
      await rows(sql`SELECT conversation_id FROM helpdesk.attachment`)
    ).toEqual([{ conversation_id: target.id }]);
    const [merged] = await rows<{
      status: string;
      merged_into_id: string;
      resolved: boolean;
    }>(
      sql`SELECT status, merged_into_id, resolved_at IS NOT NULL AS resolved FROM helpdesk.conversation WHERE id = ${source.id}::uuid`
    );
    expect(merged).toEqual({
      status: 'resolved',
      merged_into_id: target.id,
      resolved: true,
    });
    expect(
      await rows(
        sql`SELECT conversation_id, kind, data->>'reference' AS reference FROM helpdesk.conversation_event ORDER BY kind`
      )
    ).toEqual([
      {
        conversation_id: target.id,
        kind: 'merged.from',
        reference: source.reference,
      },
      {
        conversation_id: source.id,
        kind: 'merged.into',
        reference: target.reference,
      },
    ]);

    const seen = await h.call('GET', `widget/conversations/${target.id}`, {
      user: 'carol',
    });
    expect(seen.status).toBe(200);
  });

  it('threads a reply to the source plus address into the target', async () => {
    const source = await open('carol', 'First');
    const target = await open('carol', 'Second');
    await merge(source.id, target.id);

    await h.support.handleInbound({
      messageId: '<reply@mail.test>',
      from: { address: 'carol@example.test', name: 'Carol' },
      to: [`support+${source.reference}@devguard.test`],
      subject: 'Re: Export',
      text: 'Any news?',
      references: [],
      verified: true,
      automated: false,
      attachments: [],
    });

    expect(
      await rows(
        sql`SELECT conversation_id FROM helpdesk.message WHERE body = 'Any news?'`
      )
    ).toEqual([{ conversation_id: target.id }]);
  });

  it('follows a chain of merges for a reply to the first source', async () => {
    const first = await open('carol', 'First');
    const second = await open('carol', 'Second');
    const third = await open('carol', 'Third');
    await merge(first.id, second.id);
    await merge(second.id, third.id);

    await h.support.handleInbound({
      messageId: '<chain@mail.test>',
      from: { address: 'carol@example.test', name: 'Carol' },
      to: [`support+${first.reference}@devguard.test`],
      subject: 'Re: Export',
      text: 'Still there?',
      references: [],
      verified: true,
      automated: false,
      attachments: [],
    });

    expect(
      await rows(
        sql`SELECT conversation_id FROM helpdesk.message WHERE body = 'Still there?'`
      )
    ).toEqual([{ conversation_id: third.id }]);
  });

  it('refuses a widget reply to a merged-away conversation and leaves it resolved', async () => {
    const source = await open('carol', 'First');
    const target = await open('carol', 'Second');
    await merge(source.id, target.id);

    const res = await h.call(
      'POST',
      `widget/conversations/${source.id}/messages`,
      { user: 'carol', body: { body: 'Late reply' } }
    );

    expect(res.status).toBe(409);
    expect(
      await rows(sql`SELECT 1 FROM helpdesk.message WHERE body = 'Late reply'`)
    ).toEqual([]);
    expect(
      await rows(
        sql`SELECT status FROM helpdesk.conversation WHERE id = ${source.id}::uuid`
      )
    ).toEqual([{ status: 'resolved' }]);
  });

  it('keeps an unanswered customer message in the queue when the target was resolved', async () => {
    const source = await open('carol', 'Still broken');
    const target = await open('carol', 'Export');
    await h.call('PATCH', `agent/conversations/${target.id}`, {
      user: 'agent',
      body: { status: 'resolved' },
    });

    expect((await merge(source.id, target.id)).status).toBe(200);

    const [row] = await rows<{
      status: string;
      resolved_at: string | null;
      waiting: boolean;
    }>(
      sql`SELECT status, resolved_at, waiting_since IS NOT NULL AS waiting
          FROM helpdesk.conversation WHERE id = ${target.id}::uuid`
    );
    expect(row).toEqual({ status: 'open', resolved_at: null, waiting: true });
  });

  it('asks for no rating on a merged conversation', async () => {
    const source = await open('carol', 'Twice');
    const target = await open('carol', 'Once');
    expect((await merge(source.id, target.id)).status).toBe(200);

    const view = await h.call('GET', `widget/conversations/${source.id}`, {
      user: 'carol',
    });
    expect(view.data.conversation).toMatchObject({
      status: 'resolved',
      merged: true,
    });
    const rated = await h.call(
      'POST',
      `widget/conversations/${source.id}/rating`,
      { user: 'carol', body: { rating: 'bad' } }
    );
    expect(rated.status).toBe(409);
    const [row] = await rows<{ status: string; rating: string | null }>(
      sql`SELECT status, rating FROM helpdesk.conversation WHERE id = ${source.id}::uuid`
    );
    expect(row).toEqual({ status: 'resolved', rating: null });
  });

  it('refuses a merge into itself, into an unknown conversation, and from or into a merged one', async () => {
    const a = await open('carol', 'A');
    const b = await open('carol', 'B');
    const c = await open('carol', 'C');

    expect((await merge(a.id, a.id)).status).toBe(400);
    expect(
      (await merge(a.id, '00000000-0000-4000-8000-000000000000')).status
    ).toBe(400);
    expect((await merge(a.id, b.id)).status).toBe(200);
    expect((await merge(a.id, c.id)).status).toBe(409);
    expect((await merge(c.id, a.id)).status).toBe(409);
    expect(
      await rows(
        sql`SELECT 1 FROM helpdesk.message WHERE conversation_id = ${c.id}::uuid`
      )
    ).toHaveLength(1);
  });
});
