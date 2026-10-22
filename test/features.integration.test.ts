import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

const h = createHarness({ features: { deals: false } });

beforeEach(() => h.reset());
afterAll(() => h.close());

describe('features', () => {
  beforeEach(() => {
    h.addUser('agent', { isAgent: true });
  });

  it('tells the agent UI which sections are on, and answers 404 on the routes of one that is off', async () => {
    const me = await h.call('GET', 'agent/me', { user: 'agent' });
    expect(me.data.features).toEqual({
      deals: false,
      canned: true,
      overview: true,
    });

    const get = (path: string) => h.call('GET', path, { user: 'agent' });
    expect((await get('agent/deals')).status).toBe(404);
    expect(
      (
        await h.call('POST', 'agent/deals', {
          user: 'agent',
          body: { title: 'Acme renewal' },
        })
      ).status
    ).toBe(404);
    // Unregistered, not guarded: someone who is not an agent gets the same 404 as for a path that never existed.
    h.addUser('ada');
    expect((await h.call('GET', 'agent/deals', { user: 'ada' })).status).toBe(
      404
    );
    expect((await get('agent/canned')).status).toBe(200);
    expect((await get('agent/overview')).status).toBe(200);
  });
});
