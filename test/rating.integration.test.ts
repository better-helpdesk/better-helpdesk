import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

const h = createHarness({ ratingScale: 5 });

beforeEach(() => h.reset());
afterAll(() => h.close());

async function resolved(user: string) {
  h.addUser('agent', { isAgent: true });
  const res = await h.call('POST', 'widget/conversations', {
    user,
    body: { inbox: 'support', type: 'question', body: 'Where is the export?' },
  });
  const id: string = res.data.conversation.id;
  await h.call('POST', `agent/conversations/${id}/messages`, {
    user: 'agent',
    body: { body: 'Under Reports.' },
  });
  await h.call('PATCH', `agent/conversations/${id}`, {
    user: 'agent',
    body: { status: 'resolved' },
  });
  return id;
}

describe('a five-point rating', () => {
  it('takes a score, derives good or bad from it, and reopens only on 1 or 2', async () => {
    h.addUser('ada');
    const fine = await resolved('ada');
    const res = await h.call('POST', `widget/conversations/${fine}/rating`, {
      user: 'ada',
      body: { score: 3, comment: 'ok' },
    });
    expect(res.status).toBe(200);
    expect(res.data.conversation).toMatchObject({
      rating: 'bad',
      ratingScore: 3,
      status: 'resolved',
    });
    const great = await resolved('ada');
    await h.call('POST', `widget/conversations/${great}/rating`, {
      user: 'ada',
      body: { score: 5 },
    });
    expect(await h.findOne('conversation', { id: great })).toMatchObject({
      rating: 'good',
      ratingScore: 5,
    });
    const poor = await resolved('ada');
    await h.call('POST', `widget/conversations/${poor}/rating`, {
      user: 'ada',
      body: { score: 1 },
    });
    expect(await h.findOne('conversation', { id: poor })).toMatchObject({
      rating: 'bad',
      ratingScore: 1,
      status: 'open',
    });
    const without = await h.call(
      'POST',
      `widget/conversations/${poor}/rating`,
      {
        user: 'ada',
        body: { rating: 'good' },
      }
    );
    expect(without.status).toBe(400);
    const session = await h.call('GET', 'widget/session', { user: 'ada' });
    expect(session.data.ratingScale).toBe(5);
  });

  it('puts a link per score in the resolution email and rates from it', async () => {
    h.addUser('ada', { email: 'ada@example.test' });
    const id = await resolved('ada');
    await h.runDueJobs();
    const reply = h.emails.find(e => e.kind === 'customer-reply');
    const links =
      reply?.kind === 'customer-reply' ? reply.ratingLinks : undefined;
    expect(links?.scores && Object.keys(links.scores)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    expect(links?.good).toBe(links?.scores?.[5]);
    const url = new URL(links?.scores?.[4] as string);
    const page = await h.support.handler(new Request(url));
    expect(await page.text()).toContain('4 of 5');
    const posted = await h.support.handler(
      new Request(url, { method: 'POST' })
    );
    expect(posted.status).toBe(200);
    expect(await h.findOne('conversation', { id })).toMatchObject({
      rating: 'good',
      ratingScore: 4,
    });
  });

  it('averages the scores on the overview', async () => {
    h.addUser('ada');
    for (const score of [2, 5]) {
      const id = await resolved('ada');
      await h.call('POST', `widget/conversations/${id}/rating`, {
        user: 'ada',
        body: { score },
      });
    }
    const res = await h.call('GET', 'agent/overview?days=7', { user: 'agent' });
    expect(res.data.ratings).toEqual({ good: 1, bad: 1, average: 3.5 });
    expect(res.data.ratingScale).toBe(5);
  });
});
