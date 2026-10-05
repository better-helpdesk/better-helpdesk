import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

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

const exec = (query: ReturnType<typeof sql>) =>
  h.support.store.db.execute(query);

/** A conversation opened `createdAt`, answered after `replyAfter`, resolved after `resolveAfter`. */
async function seed(
  inbox: string,
  createdAt: ReturnType<typeof sql>,
  replyAfter: string | null,
  resolveAfter: string | null,
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
  await exec(sql`UPDATE helpdesk.conversation SET created_at = ${createdAt},
    resolved_at = ${createdAt} + ${resolveAfter}::interval,
    status = ${resolveAfter ? 'resolved' : 'open'},
    assignee_id = (SELECT id FROM helpdesk.agent WHERE name = ${assignee})
    WHERE id = ${id}::uuid`);
  await exec(sql`UPDATE helpdesk.message m SET created_at = c.created_at + CASE
      WHEN m.internal THEN interval '1 minute'
      WHEN m.author_type = 'agent' THEN ${replyAfter}::interval
      ELSE interval '0' END
    FROM helpdesk.conversation c WHERE c.id = m.conversation_id AND c.id = ${id}::uuid`);
}

describe('overview', () => {
  it('counts volume and the median first response and resolution, per inbox and assignee', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    await h.call('GET', 'agent/me', { user: 'agent' });
    const recent = sql`now() - interval '10 hours'`;
    await seed('support', recent, '1 hour', '4 hours', 'agent');
    await seed('support', recent, '3 hours', '6 hours', 'agent');
    await seed('support', recent, '2 hours', null);
    await seed('support', recent, null, null);
    await seed('support', sql`now() - interval '40 days'`, '9 hours', null);

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
      sql`date_trunc('day', now()) - interval '2 days' + interval '8 hours 30 minutes'`,
      '1 day',
      '2 days'
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
    const recent = sql`now() - interval '10 hours'`;
    await seed('support', recent, '1 hour', '2 hours');
    await seed('support', recent, '1 hour', '2 hours');
    await seed('support', recent, '1 hour', '2 hours');
    const [good, bad, merged] = (
      await exec(sql`SELECT id FROM helpdesk.conversation ORDER BY number`)
    ).rows as { id: string }[];
    await exec(sql`UPDATE helpdesk.conversation SET rating = 'good', rated_at = now()
      WHERE id = ${good?.id}::uuid`);
    await exec(sql`UPDATE helpdesk.conversation SET rating = 'bad', rated_at = now()
      WHERE id = ${bad?.id}::uuid`);
    await exec(sql`UPDATE helpdesk.conversation SET merged_into_id = ${good?.id}::uuid
      WHERE id = ${merged?.id}::uuid`);

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
