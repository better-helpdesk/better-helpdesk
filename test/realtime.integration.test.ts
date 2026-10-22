import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { memoryRealtime, postgresRealtime, type RealtimeChange } from '../src';
import { ADMIN_ORIGIN, createHarness } from './harness';

const realtime = memoryRealtime();
const h = createHarness({ realtime });
const plain = createHarness();

beforeEach(async () => {
  await h.reset();
  await plain.reset();
});
afterAll(async () => {
  await h.close();
  await plain.close();
});

async function open(
  user: string,
  body: Record<string, unknown>,
  harness = h
): Promise<string> {
  const res = await harness.call('POST', 'widget/conversations', {
    user,
    body: { inbox: 'support', type: 'question', body: 'Hello there', ...body },
  });
  expect(res.status).toBe(201);
  return res.data.conversation.id;
}

/** Reads `path`'s event stream until `count` changes arrived or it went quiet. */
async function follow(path: string, user: string) {
  const controller = new AbortController();
  const response = await h.support.handler(
    new Request(`${ADMIN_ORIGIN}/api/helpdesk/${path}`, {
      headers: { 'x-test-user': user },
      signal: controller.signal,
    })
  );
  const changes: RealtimeChange[] = [];
  const reader = response.body
    ?.pipeThrough(new TextDecoderStream())
    .getReader();
  let buffer = '';
  const reading = (async () => {
    while (reader) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += value;
      for (const match of buffer.matchAll(/^data: (.+)$/gm)) {
        changes.push(JSON.parse(match[1] as string));
      }
      buffer = buffer.slice(buffer.lastIndexOf('\n\n') + 2);
    }
  })().catch(() => undefined);
  return {
    response,
    changes,
    async settle() {
      await new Promise(resolve => setTimeout(resolve, 20));
    },
    async stop() {
      controller.abort();
      // Cancelling the reader ends the stream on its own; Node 22 can lose an
      // abort on a Request nothing else holds.
      await reader?.cancel().catch(() => undefined);
      await reading;
    },
  };
}

describe('the kind of a conversation', () => {
  it('is a chat for a message and a ticket for a form with a subject', async () => {
    h.addUser('ada');
    const chat = await open('ada', {});
    const ticket = await open('ada', { type: 'bug', subject: 'Export broken' });

    const rows = await h.find('conversation');
    expect(rows.find(r => r.id === chat)?.kind).toBe('chat');
    expect(rows.find(r => r.id === ticket)?.kind).toBe('ticket');
    // The customer's view says which, as the server stored it.
    const session = await h.call('GET', 'widget/session', { user: 'ada' });
    expect(
      Object.fromEntries(
        session.data.conversations.map((c: { id: string; kind: string }) => [
          c.id,
          c.kind,
        ])
      )
    ).toEqual({ [chat]: 'chat', [ticket]: 'ticket' });
  });

  it('takes the kind the widget names over the guess', async () => {
    h.addUser('ada');
    const id = await open('ada', { kind: 'ticket' });

    expect((await h.findOne('conversation', { id }))?.kind).toBe('ticket');
  });

  it('refuses a kind it does not know', async () => {
    h.addUser('ada');
    const res = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: { inbox: 'support', type: 'question', body: 'Hi', kind: 'call' },
    });

    expect(res.status).toBe(400);
    expect(await h.count('conversation')).toBe(0);
  });
});

describe('an agent typing', () => {
  it('shows to the customer until the reply lands', async () => {
    h.addUser('ada');
    h.addUser('sam', { isAgent: true });
    const id = await open('ada', {});
    const typing = async () =>
      (await h.call('GET', `widget/conversations/${id}`, { user: 'ada' })).data
        .conversation.typing;

    expect(await typing()).toBe(false);
    const ping = await h.call('POST', `agent/conversations/${id}/typing`, {
      user: 'sam',
      body: {},
    });
    expect(ping.status).toBe(200);
    expect(await typing()).toBe(true);

    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'sam',
      body: { body: 'Looking now' },
    });
    expect(await typing()).toBe(false);
  });

  it('stays lit through an internal note', async () => {
    h.addUser('ada');
    h.addUser('sam', { isAgent: true });
    const id = await open('ada', {});
    await h.call('POST', `agent/conversations/${id}/typing`, {
      user: 'sam',
      body: {},
    });
    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'sam',
      body: { body: 'Ask the platform team', internal: true },
    });

    expect(
      (await h.findOne('conversation', { id }))?.agentTypingUntil
    ).not.toBeNull();
  });

  it('is an agent route', async () => {
    h.addUser('ada');
    const id = await open('ada', {});
    const res = await h.call('POST', `agent/conversations/${id}/typing`, {
      user: 'ada',
      body: {},
    });

    expect(res.status).toBe(403);
    expect((await h.findOne('conversation', { id }))?.agentTypingUntil).toBe(
      null
    );
  });
});

describe('event streams', () => {
  it('tells the customer about a reply and typing in their thread', async () => {
    h.addUser('ada');
    h.addUser('sam', { isAgent: true });
    const id = await open('ada', {});
    const stream = await follow('widget/events', 'ada');
    expect(stream.response.headers.get('content-type')).toMatch(
      /^text\/event-stream/
    );

    await h.call('POST', `agent/conversations/${id}/typing`, {
      user: 'sam',
      body: {},
    });
    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'sam',
      body: { body: 'Looking now' },
    });
    await stream.settle();
    await stream.stop();

    expect(stream.changes).toEqual([
      { conversationId: id, kind: 'typing' },
      { conversationId: id, kind: 'message' },
    ]);
  });

  it('keeps internal notes and other customers’ threads off a customer’s stream', async () => {
    h.addUser('ada');
    h.addUser('bob');
    h.addUser('sam', { isAgent: true });
    const own = await open('ada', {});
    const other = await open('bob', {});
    const stream = await follow('widget/events', 'ada');

    await h.call('POST', `agent/conversations/${own}/messages`, {
      user: 'sam',
      body: { body: 'Ask the platform team', internal: true },
    });
    await h.call('POST', `agent/conversations/${other}/messages`, {
      user: 'sam',
      body: { body: 'Hello Bob' },
    });
    await stream.settle();
    await stream.stop();

    expect(stream.changes).toEqual([]);
  });

  it('gives agents every change, notes included', async () => {
    h.addUser('ada');
    h.addUser('sam', { isAgent: true });
    const id = await open('ada', {});
    const stream = await follow('agent/events', 'sam');

    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'sam',
      body: { body: 'Ask the platform team', internal: true },
    });
    await h.call('POST', `widget/conversations/${id}/messages`, {
      user: 'ada',
      body: { body: 'Any news?' },
    });
    await stream.settle();
    await stream.stop();

    expect(stream.changes).toEqual([
      { conversationId: id, kind: 'message', internal: true },
      { conversationId: id, kind: 'message' },
    ]);
  });

  it('refuses a customer the agent stream and a stranger the widget stream', async () => {
    h.addUser('ada');

    expect((await h.call('GET', 'agent/events', { user: 'ada' })).status).toBe(
      403
    );
    expect((await h.call('GET', 'widget/events')).status).toBe(401);
  });

  it('is not there without a realtime adapter, and the clients are told so', async () => {
    plain.addUser('ada');
    plain.addUser('sam', { isAgent: true });

    expect(
      (await plain.call('GET', 'widget/events', { user: 'ada' })).status
    ).toBe(404);
    expect(
      (await plain.call('GET', 'agent/events', { user: 'sam' })).status
    ).toBe(404);
    expect(
      (await plain.call('GET', 'widget/session', { user: 'ada' })).data.realtime
    ).toBe(false);
    expect(
      (await h.call('GET', 'widget/session', { user: 'ada' })).data.realtime
    ).toBe(true);
  });
});

const onPostgres =
  (h.adapter as { family?: string }).family === 'postgres' && h.pool;

describe.skipIf(!onPostgres)('postgresRealtime', () => {
  it('carries a change from one process’s adapter to another’s subscriber', async () => {
    // biome-ignore lint/style/noNonNullAssertion: the suite is skipped without a pool
    const pool = h.pool!;
    const writer = postgresRealtime({ pool });
    const reader = postgresRealtime({ pool });
    const heard: RealtimeChange[] = [];
    const leave = reader.subscribe(change => heard.push(change));
    // LISTEN takes a connection first; a change published before it is not heard.
    await new Promise(resolve => setTimeout(resolve, 200));

    await writer.publish({ conversationId: 'c1', kind: 'typing' });

    await expect
      .poll(() => heard, { timeout: 5000 })
      .toEqual([{ conversationId: 'c1', kind: 'typing' }]);
    leave();
  });
});
