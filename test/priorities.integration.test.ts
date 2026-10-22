import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { buildHelpdesk } from '../src';
import { createHarness } from './harness';

// Harbor's own ladder, lowest first, with none of the package's words in it.
const h = createHarness({
  priorities: ['p3', 'p2', 'p1'],
  priorityLabels: { p1: { en: 'P1' } },
  inboxes: {
    support: {
      priorities: {
        options: {
          p1: { en: 'Everything is down' },
          p2: { en: 'A key function' },
        },
      },
    },
    sales: { public: true, defaultPriority: 'p2' },
  },
  sla: { default: { targets: { p1: { respond: 1 } } } },
});

beforeEach(() => h.reset());
afterAll(() => h.close());

async function open(user: string, body: Record<string, unknown> = {}) {
  const res = await h.call('POST', 'widget/conversations', {
    user,
    body: { inbox: 'support', type: 'bug', body: 'Deploys fail', ...body },
  });
  expect(res.status).toBe(201);
  return res.data.conversation as { id: string };
}

describe('a host-defined priority list', () => {
  it('starts conversations at the lowest, or the inbox default, and refuses the package words', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const { id } = await open('ada');
    expect(await h.findOne('conversation', { id })).toMatchObject({
      priority: 'p3',
    });
    const sales = await h.call('POST', 'widget/conversations', {
      body: {
        inbox: 'sales',
        type: 'lead',
        body: 'Pricing?',
        email: 'lead@example.test',
      },
    });
    expect(
      await h.findOne('conversation', { id: sales.data.conversation.id })
    ).toMatchObject({
      priority: 'p2',
    });
    expect(
      (
        await h.call('PATCH', `agent/conversations/${id}`, {
          user: 'agent',
          body: { priority: 'urgent' },
        })
      ).status
    ).toBe(400);
    const me = await h.call('GET', 'agent/me', { user: 'agent' });
    expect(me.data).toMatchObject({
      priorities: ['p3', 'p2', 'p1'],
      defaultPriority: 'p3',
    });
  });

  it('lets the customer pick from the list, starts the clock on it, and treats the two highest as high and urgent', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const low = await open('ada');
    const top = await open('ada', { priority: 'p1' });
    const mid = await open('ada', { priority: 'p2' });
    expect(await h.findOne('conversation', { id: top.id })).toMatchObject({
      priority: 'p1',
      respondBy: expect.any(Date),
    });
    const high = await h.call('GET', 'agent/conversations?priority=high', {
      user: 'agent',
    });
    expect(
      high.data.conversations.map((c: { id: string }) => c.id).sort()
    ).toEqual([mid.id, top.id].sort());
    const ranked = await h.call('GET', 'agent/conversations?sort=priority', {
      user: 'agent',
    });
    expect(ranked.data.conversations.map((c: { id: string }) => c.id)).toEqual([
      top.id,
      mid.id,
      low.id,
    ]);
  });
});

describe('priorities named elsewhere in the config', () => {
  const base = {
    db: h.adapter,
    referencePrefix: 'DG',
    adminUrl: 'https://app.test/helpdesk/',
    identify: async () => null,
  };

  it('must be in the list', () => {
    expect(() =>
      buildHelpdesk({
        ...base,
        priorities: ['p2', 'p1'],
        inboxes: { support: { defaultPriority: 'normal' } },
      })
    ).toThrow(/Inbox support names priorities .*normal/);
    expect(() =>
      buildHelpdesk({
        ...base,
        priorities: ['p2', 'p1'],
        inboxes: { support: {} },
        sla: { default: { targets: { urgent: { respond: 1 } } } },
      })
    ).toThrow(/sla policy default .*urgent/);
    expect(() =>
      buildHelpdesk({
        ...base,
        priorities: ['p1', 'p1'],
        inboxes: { support: {} },
      })
    ).toThrow(/Invalid priorities/);
    expect(() =>
      buildHelpdesk({ ...base, priorities: [], inboxes: { support: {} } })
    ).toThrow(/Invalid priorities/);
  });
});
