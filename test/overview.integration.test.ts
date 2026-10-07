import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { ago, createHarness, DAY, HOUR, MINUTE } from './harness';

const h = createHarness({
  inboxes: {
    support: {},
    office: {
      hours: {
        timeZone: 'UTC',
        weekly: Object.fromEntries(
          ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => [
            d,
            [['08:00', '09:00']],
          ])
        ),
      },
    },
  },
});

beforeEach(() => h.reset());
afterAll(() => h.close());

/** A conversation opened `createdAt`, answered after `replyAfter`, resolved after `resolveAfter`. */
async function seed(
  inbox: string,
  createdAt: Date,
  replyAfter: number | null,
  resolveAfter: number | null,
  assignee: string | null = null
) {
  const res = await h.call('POST', 'widget/conversations', {
    user: 'ada',
    body: { inbox, type: 'question', body: 'Where is the export?' },
  });
  expect(res.status).toBe(201);
  const id: string = res.data.conversation.id;
  await h.call('POST', `agent/conversations/${id}/messages`, {
    user: 'agent',
    body: { body: 'a note before the reply', internal: true },
  });
  if (replyAfter)
    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'agent',
      body: { body: 'the reply' },
    });
  const agent = assignee ? await h.findOne('agent', { name: assignee }) : null;
  await h.update(
    'conversation',
    { id },
    {
      createdAt,
      resolvedAt:
        resolveAfter === null
          ? null
          : new Date(createdAt.getTime() + resolveAfter),
      status: resolveAfter ? 'resolved' : 'open',
      assigneeId: agent?.id ?? null,
    }
  );
  for (const m of await h.find('message', { conversationId: id })) {
    const offset = m.internal
      ? MINUTE
      : m.authorType === 'agent'
        ? (replyAfter ?? 0)
        : 0;
    await h.update(
      'message',
      { id: m.id },
      { createdAt: new Date(createdAt.getTime() + offset) }
    );
  }
}

describe('overview', () => {
  it('counts volume and the median first response and resolution, per inbox and assignee', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    await h.call('GET', 'agent/me', { user: 'agent' });
    const recent = ago(10 * HOUR);
    await seed('support', recent, HOUR, 4 * HOUR, 'agent');
    await seed('support', recent, 3 * HOUR, 6 * HOUR, 'agent');
    await seed('support', recent, 2 * HOUR, null);
    await seed('support', recent, null, null);
    await seed('support', ago(40 * DAY), 9 * HOUR, null);

    const res = await h.call('GET', 'agent/overview?days=30', {
      user: 'agent',
    });
    expect(res.status).toBe(200);
    const numbers = { new: 4, resolved: 2, firstResponse: 2, resolution: 5 };
    expect(res.data.total).toEqual(numbers);
    expect(res.data.inboxes).toEqual([{ inbox: 'support', ...numbers }]);
    expect(res.data.agents).toEqual(
      expect.arrayContaining([
        {
          agentId: expect.any(String),
          name: 'agent',
          new: 2,
          resolved: 2,
          firstResponse: 2,
          resolution: 5,
        },
        {
          agentId: null,
          name: null,
          new: 2,
          resolved: 0,
          firstResponse: 2,
          resolution: null,
        },
      ])
    );
    expect(res.data.openHours).toBe(false);
    expect(res.data.ratings).toBeNull();

    const quarter = await h.call('GET', 'agent/overview?days=90', {
      user: 'agent',
    });
    expect(quarter.data.total).toMatchObject({ new: 5, firstResponse: 2.5 });
  });

  it('counts open hours only in an inbox with business hours', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    await h.call('GET', 'agent/me', { user: 'agent' });
    // Open 08:00 to 09:00 every day: a day's wait from 08:30 is one open hour.
    await seed(
      'office',
      new Date(Math.floor(Date.now() / DAY) * DAY - 2 * DAY + 8.5 * HOUR),
      DAY,
      2 * DAY
    );

    const res = await h.call('GET', 'agent/overview?days=7', {
      user: 'agent',
    });
    expect(res.data.openHours).toBe(true);
    expect(res.data.total).toEqual({
      new: 1,
      resolved: 1,
      firstResponse: 1,
      resolution: 2,
    });
  });

  it('leaves merged-away conversations out and splits the ratings', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    await h.call('GET', 'agent/me', { user: 'agent' });
    const recent = ago(10 * HOUR);
    await seed('support', recent, HOUR, 2 * HOUR);
    await seed('support', recent, HOUR, 2 * HOUR);
    await seed('support', recent, HOUR, 2 * HOUR);
    const [good, bad, merged] = await h.find(
      'conversation',
      {},
      { orderBy: { number: 'asc' } }
    );
    await h.update(
      'conversation',
      { id: good?.id },
      { rating: 'good', ratedAt: new Date() }
    );
    await h.update(
      'conversation',
      { id: bad?.id },
      { rating: 'bad', ratedAt: new Date() }
    );
    await h.update(
      'conversation',
      { id: merged?.id },
      { mergedIntoId: good?.id }
    );

    const res = await h.call('GET', 'agent/overview?days=7', {
      user: 'agent',
    });
    expect(res.data.total).toMatchObject({ new: 2, resolved: 2 });
    expect(res.data.ratings).toEqual({ good: 1, bad: 1 });
  });

  it('is for agents only', async () => {
    h.addUser('ada');
    const res = await h.call('GET', 'agent/overview', { user: 'ada' });
    expect(res.status).toBe(403);
  });
});
