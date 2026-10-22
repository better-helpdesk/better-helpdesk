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
});
afterAll(() => h.close());

describe('a conversation the team starts', () => {
  it('opens pending for a known contact, assigned to the agent, and emails the customer the message', async () => {
    h.addUser('ada', { email: 'ada@example.test' });
    h.addUser('agent', { isAgent: true });
    await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: { inbox: 'support', type: 'question', body: 'earlier' },
    });
    const contact = await h.findOne('contact', { email: 'ada@example.test' });
    const res = await h.call('POST', 'agent/conversations', {
      user: 'agent',
      body: {
        inbox: 'support',
        type: 'question',
        contactId: contact?.id,
        subject: 'Your call this morning',
        body: 'As discussed, the export is back.',
        priority: 'high',
        tags: ['phone'],
      },
    });
    expect(res.status).toBe(201);
    const agent = await h.findOne('agent', { name: 'agent' });
    expect(res.data.conversation).toMatchObject({
      status: 'pending',
      channel: 'agent',
      priority: 'high',
      assigneeId: agent?.id,
      tags: ['phone'],
      waitingSince: null,
      firstRespondedAt: expect.any(String),
    });
    const message = await h.findOne('message', {
      conversationId: res.data.conversation.id,
    });
    expect(message).toMatchObject({ authorType: 'agent', agentId: agent?.id });
    expect(events.at(-1)).toMatchObject({
      kind: 'conversation.created',
      message: { authorType: 'agent' },
    });
    await h.runDueJobs();
    expect(h.emails.filter(e => e.kind !== 'agent-new')).toEqual([
      expect.objectContaining({
        kind: 'customer-reply',
        to: 'ada@example.test',
        subject: 'Your call this morning',
        body: 'As discussed, the export is back.',
      }),
    ]);
    const widget = await h.call('GET', 'widget/session', { user: 'ada' });
    expect(widget.data.conversations[0]).toMatchObject({
      subject: 'Your call this morning',
      status: 'pending',
    });
  });

  it('makes a contact from an address nobody knows, and refuses a blocked one', async () => {
    h.addUser('agent', { isAgent: true });
    const res = await h.call('POST', 'agent/conversations', {
      user: 'agent',
      body: {
        inbox: 'support',
        type: 'question',
        email: 'New@Example.test',
        name: 'Newcomer',
        subject: 'Welcome',
        body: 'Hello there.',
      },
    });
    expect(res.status).toBe(201);
    const contact = await h.findOne('contact', { email: 'new@example.test' });
    expect(contact).toMatchObject({ name: 'Newcomer' });
    await h.update('contact', { id: contact?.id }, { blocked: true });
    const again = await h.call('POST', 'agent/conversations', {
      user: 'agent',
      body: {
        inbox: 'support',
        type: 'question',
        email: 'new@example.test',
        subject: 'x',
        body: 'y',
      },
    });
    expect(again.status).toBe(404);
  });

  it('is refused without a contact or an address, and for a viewer', async () => {
    h.addUser('agent', { isAgent: true });
    h.addUser('eve', { isAgent: true, role: 'viewer' });
    const body = {
      inbox: 'support',
      type: 'question',
      subject: 'x',
      body: 'y',
    };
    expect(
      (await h.call('POST', 'agent/conversations', { user: 'agent', body }))
        .status
    ).toBe(400);
    expect(
      (
        await h.call('POST', 'agent/conversations', {
          user: 'eve',
          body: { ...body, email: 'a@b.test' },
        })
      ).status
    ).toBe(403);
  });
});

describe('from host code', () => {
  it('opens a conversation in an agent’s name, adds notes, and changes it with events', async () => {
    h.addUser('agent', { isAgent: true });
    await h.call('GET', 'agent/me', { user: 'agent' });
    const { conversation } = await h.support.openConversation({
      agentUserId: 'user-agent',
      inbox: 'support',
      type: 'bug',
      email: 'ops@example.test',
      subject: 'Incident INC-42',
      body: 'We are looking into the outage you reported by phone.',
    });
    expect(conversation.channel).toBe('agent');

    const note = await h.support.addNote(
      conversation.id,
      'PagerDuty acknowledged by Sam.'
    );
    expect(note).toMatchObject({ authorType: 'system', internal: true });
    expect(events.at(-1)).toMatchObject({
      kind: 'message.created',
      internal: true,
      message: { body: 'PagerDuty acknowledged by Sam.' },
    });
    const widget = await h.call(
      'GET',
      `widget/conversations/${conversation.id}`,
      {
        headers: { 'x-helpdesk-visitor': 'nope' },
      }
    );
    expect(widget.status).toBe(404);

    const changed = await h.support.changeConversation(
      conversation.id,
      { status: 'resolved', tags: ['incident'] },
      { agentUserId: 'user-agent' }
    );
    expect(changed).toMatchObject({ status: 'resolved', tags: ['incident'] });
    const agent = await h.findOne('agent', { name: 'agent' });
    expect(events.at(-1)).toMatchObject({
      kind: 'conversation.updated',
      before: { status: 'pending', tags: [] },
      agentId: agent?.id,
    });
    await expect(
      h.support.changeConversation(conversation.id, { priority: 'nope' })
    ).rejects.toThrow();
    await expect(
      h.support.openConversation({
        agentUserId: 'nobody',
        inbox: 'support',
        type: 'bug',
        email: 'x@y.test',
        subject: 'x',
        body: 'y',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('labels a conversation opened through createConversation as from the app', async () => {
    h.addUser('ada');
    const { conversation } = await h.support.createConversation(
      new Request('https://app.test/', { headers: { 'x-test-user': 'ada' } }),
      { inbox: 'support', type: 'question', body: 'From a webhook' }
    );
    expect(conversation?.channel).toBe('api');
  });
});

describe('bulk replies', () => {
  it('sends one reply to each selected conversation and a note to each', async () => {
    h.addUser('ada', { email: 'ada@example.test' });
    h.addUser('bob', { email: 'bob@example.test' });
    h.addUser('agent', { isAgent: true });
    const ids: string[] = [];
    for (const user of ['ada', 'bob']) {
      const res = await h.call('POST', 'widget/conversations', {
        user,
        body: { inbox: 'support', type: 'bug', body: 'Deploys fail' },
      });
      ids.push(res.data.conversation.id);
    }
    const res = await h.call('POST', 'agent/conversations/bulk', {
      user: 'agent',
      body: {
        ids,
        addTag: 'incident-7',
        reply: 'A fix is rolling out now.',
        note: 'Grouped under the status page incident.',
      },
    });
    expect(res.status).toBe(200);
    for (const id of ids) {
      const messages = await h.find(
        'message',
        { conversationId: id },
        { orderBy: { createdAt: 'asc' } }
      );
      expect(messages.map(m => [m.authorType, m.internal, m.body])).toEqual([
        ['contact', false, 'Deploys fail'],
        ['agent', true, 'Grouped under the status page incident.'],
        ['agent', false, 'A fix is rolling out now.'],
      ]);
      const detail = await h.call('GET', `agent/conversations/${id}`, {
        user: 'agent',
      });
      expect(detail.data.conversation).toMatchObject({
        status: 'pending',
        tags: ['incident-7'],
      });
    }
    await h.runDueJobs();
    expect(
      h.emails
        .filter(e => e.kind === 'customer-reply')
        .map(e => e.to)
        .sort()
    ).toEqual(['ada@example.test', 'bob@example.test']);
  });
});
