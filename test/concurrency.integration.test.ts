import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

const h = createHarness();
beforeEach(() => h.reset());
afterAll(() => h.close());

// What the database gives each adapter differently: these hold on all of them.
describe('concurrency', () => {
  it('claims each of 50 jobs exactly once across 5 runners', async () => {
    for (let i = 0; i < 50; i++) {
      await h.support.store.enqueueJob('ai-triage', {
        conversationId: randomUUID(),
      });
    }
    const runs = await Promise.all(
      Array.from({ length: 5 }, () => h.support.store.claimJobs(10))
    );
    const ids = runs.flat().map(j => j.id);
    expect(ids).toHaveLength(50);
    expect(new Set(ids).size).toBe(50);
  });

  it('counts 50 simultaneous hits on one rate limit as 50', async () => {
    const totals = await Promise.all(
      Array.from({ length: 50 }, () => h.support.store.hitRateLimit('ip:1'))
    );
    expect(Math.max(...totals)).toBe(50);
    const [row] = await h.find('rate_limit', { key: 'ip:1' });
    expect(row?.count).toBe(50);
  });

  it('hands out distinct references to conversations opened at once', async () => {
    const contact = await h.support.store.createContact({ name: 'Ada' });
    const opened = await Promise.all(
      Array.from({ length: 20 }, () =>
        h.support.store.createConversation(
          { inbox: 'support', type: 'question', contactId: contact.id },
          { body: 'Hello', contactId: contact.id, verified: true }
        )
      )
    );
    const numbers = opened.map(o => o.conversation.number);
    expect(new Set(numbers).size).toBe(20);
  });
});

describe('tags', () => {
  it('keeps the tags of one writer whole when two write at once', async () => {
    const contact = await h.support.store.createContact({ name: 'Ada' });
    const { conversation } = await h.support.store.createConversation(
      { inbox: 'support', type: 'question', contactId: contact.id },
      { body: 'Hello', contactId: contact.id, verified: true }
    );
    for (let round = 0; round < 10; round++) {
      const writes = await Promise.allSettled([
        h.support.store.updateConversation(conversation.id, {
          tags: ['a', 'b'],
        }),
        h.support.store.updateConversation(conversation.id, {
          tags: ['a', 'c'],
        }),
      ]);
      expect(writes.map(w => w.status)).toEqual(['fulfilled', 'fulfilled']);
      const tags = (await h.support.store.getConversation(conversation.id))
        ?.tags;
      expect([
        ['a', 'b'],
        ['a', 'c'],
      ]).toContainEqual(tags);
    }
  });
});
