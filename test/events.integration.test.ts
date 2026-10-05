import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HelpdeskEvent } from '../src';
import { createHarness } from './harness';

const events: HelpdeskEvent[] = [];
let fail = false;
const h = createHarness({
  async onEvent(event) {
    if (fail) throw new Error('hook down');
    events.push(event);
  },
});

beforeEach(async () => {
  await h.reset();
  events.length = 0;
  fail = false;
});
afterAll(() => h.close());

async function open() {
  h.addUser('ada');
  const res = await h.call('POST', 'widget/conversations', {
    user: 'ada',
    body: { inbox: 'support', type: 'bug', body: 'The CSV export fails' },
  });
  expect(res.status).toBe(201);
  return res.data.conversation as { id: string; reference: string };
}

describe('onEvent', () => {
  it('reports a conversation opened in the widget with its first message', async () => {
    const { id } = await open();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'conversation.created',
      conversation: { id, type: 'bug', status: 'open' },
      message: { conversationId: id, body: 'The CSV export fails' },
    });
  });

  it('reports a conversation opened by email', async () => {
    await h.support.handleInbound({
      messageId: '<first@mail.test>',
      from: { address: 'bob@example.test' },
      to: ['support@devguard.test'],
      subject: 'Invoice question',
      text: 'Where is my invoice?',
      references: [],
      verified: true,
      automated: false,
      attachments: [],
    });
    expect(events).toMatchObject([
      {
        kind: 'conversation.created',
        conversation: { subject: 'Invoice question' },
        message: { body: 'Where is my invoice?' },
      },
    ]);
  });

  it('reports messages from the customer, by email and from agents with the conversation as it now stands', async () => {
    const { id, reference } = await open();
    h.addUser('agent', { isAgent: true });
    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'agent',
      body: { body: 'Looking into it' },
    });
    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'agent',
      body: { body: 'Same as last week', internal: true },
    });
    await h.call('POST', `widget/conversations/${id}/messages`, {
      user: 'ada',
      body: { body: 'Thanks' },
    });
    await h.support.handleInbound({
      messageId: '<reply@mail.test>',
      from: { address: 'ada@example.test' },
      to: [`support+${reference}@devguard.test`],
      subject: 'Re: export',
      text: 'Still failing',
      references: [],
      verified: true,
      automated: false,
      attachments: [],
    });

    expect(
      events
        .slice(1)
        .map(e =>
          e.kind === 'message.created'
            ? [e.message.body, e.internal, e.conversation.status]
            : e.kind
        )
    ).toEqual([
      ['Looking into it', false, 'pending'],
      ['Same as last week', true, 'pending'],
      ['Thanks', false, 'open'],
      ['Still failing', false, 'open'],
    ]);
  });

  it('reports what an agent changed, with the values before and who changed it', async () => {
    const { id } = await open();
    h.addUser('agent', { isAgent: true });
    const res = await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { status: 'resolved', priority: 'normal', type: 'question' },
    });
    expect(res.status).toBe(200);
    const [agent] = await h.support.store.listAgents();

    expect(events[1]).toEqual({
      kind: 'conversation.updated',
      conversation: expect.objectContaining({
        id,
        status: 'resolved',
        type: 'question',
      }),
      before: {
        status: 'open',
        type: 'bug',
        resolvedAt: null,
        waitingSince: expect.any(Date),
      },
      agentId: agent?.id,
    });
  });

  it('reports the tags an agent changed', async () => {
    const { id } = await open();
    h.addUser('agent', { isAgent: true });
    await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { tags: ['Billing'] },
    });
    expect(events[1]).toMatchObject({
      kind: 'conversation.updated',
      conversation: { tags: ['billing'] },
      before: { tags: [] },
    });
  });

  it('stays quiet when an agent changes nothing', async () => {
    const { id } = await open();
    h.addUser('agent', { isAgent: true });
    await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { priority: 'normal' },
    });
    expect(events.map(e => e.kind)).toEqual(['conversation.created']);
  });

  it('reports an accepted triage suggestion as a change', async () => {
    const { id } = await open();
    h.addUser('agent', { isAgent: true });
    await h.support.store.updateConversation(id, {
      aiSuggestion: { type: 'question', priority: 'urgent', title: 'Export' },
    });
    await h.call('POST', `agent/conversations/${id}/suggestion`, {
      user: 'agent',
      body: { action: 'accept' },
    });
    expect(events[1]).toMatchObject({
      kind: 'conversation.updated',
      conversation: { priority: 'urgent', type: 'question', title: 'Export' },
      before: { priority: 'normal', type: 'bug', title: null },
    });
  });

  it('reports a reply that reopens a resolved conversation as a message on an open one', async () => {
    const { id } = await open();
    h.addUser('agent', { isAgent: true });
    await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { status: 'resolved' },
    });
    await h.call('POST', `widget/conversations/${id}/messages`, {
      user: 'ada',
      body: { body: 'Still broken' },
    });
    expect(events.slice(2)).toMatchObject([
      {
        kind: 'message.created',
        conversation: { status: 'open', resolvedAt: null },
        message: { body: 'Still broken' },
      },
    ]);
  });

  it('reports a snooze that runJobs wakes, with no agent', async () => {
    const { id } = await open();
    h.addUser('agent', { isAgent: true });
    const until = new Date(Date.now() + 3_600_000);
    await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { snoozedUntil: until.toISOString() },
    });
    await h.support.store.updateConversation(id, {
      snoozedUntil: new Date(Date.now() - 60_000),
    });
    await h.support.runJobs();
    expect(events.slice(2)).toEqual([
      {
        kind: 'conversation.updated',
        conversation: expect.objectContaining({
          id,
          status: 'open',
          snoozedUntil: null,
        }),
        before: { status: 'pending', snoozedUntil: expect.any(Date) },
        agentId: null,
      },
    ]);
  });

  it('logs a failing hook and still answers 201', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    fail = true;
    const { id } = await open();
    expect(await h.support.store.getConversation(id)).toMatchObject({ id });
    expect(error).toHaveBeenCalledWith(
      '[helpdesk] onEvent conversation.created failed',
      expect.any(Error)
    );
    error.mockRestore();
  });
});
