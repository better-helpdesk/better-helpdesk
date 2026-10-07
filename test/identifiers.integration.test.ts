import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

const h = createHarness();
beforeEach(() => h.reset());
afterAll(() => h.close());

async function open(user: string, orgId: string) {
  const res = await h.call('POST', 'widget/conversations', {
    user,
    body: {
      inbox: 'support',
      type: 'bug',
      body: `From ${user}`,
      orgId,
      sharedWithCompany: true,
    },
  });
  expect(res.status).toBe(201);
  return res.data.conversation.id as string;
}

// Databases that compare text ignoring case by default must not here: an
// identifier differing only in case is somebody else.
describe('identifiers', () => {
  it('keeps users and organizations that differ only in case apart', async () => {
    // Distinct emails: a shared verified email joins two users on purpose.
    h.addUser('Ab', {
      orgs: [{ id: 'ACME', name: 'Acme' }],
      email: 'upper@example.test',
    });
    h.addUser('ab', {
      orgs: [{ id: 'acme', name: 'acme' }],
      email: 'lower@example.test',
    });
    const upper = await open('Ab', 'ACME');
    const lower = await open('ab', 'acme');

    for (const [user, own] of [
      ['Ab', upper],
      ['ab', lower],
    ] as const) {
      const res = await h.call('GET', 'widget/session', { user });
      expect(res.status).toBe(200);
      expect(res.data.conversations.map((c: { id: string }) => c.id)).toEqual([
        own,
      ]);
    }
    expect(await h.count('contact')).toBe(2);
    expect(await h.count('company')).toBe(2);
  });

  it('refuses a verified identity another contact already holds, leaving theirs alone', async () => {
    const first = await h.support.store.createContact(
      { name: 'First' },
      { channel: 'email', externalId: 'ada@example.test', verified: true }
    );
    const second = await h.support.store.createContact({ name: 'Second' });
    await expect(
      h.support.store.addIdentity(second.id, {
        channel: 'email',
        externalId: 'ada@example.test',
        verified: true,
      })
    ).rejects.toThrow();
    const held = await h.find('identity', { externalId: 'ada@example.test' });
    expect(held.map(i => [i.contactId, i.verified])).toEqual([
      [first.id, true],
    ]);
  });

  it('refuses an email longer than any address can be, and leaves out a host email that long', async () => {
    const long = `${'a'.repeat(250)}@example.test`;
    const res = await h.call('POST', 'widget/conversations', {
      body: { inbox: 'sales', type: 'lead', body: 'Pricing?', email: long },
    });
    expect(res.status).toBe(400);
    expect(await h.count('contact')).toBe(0);

    h.addUser('long', { email: long });
    expect(
      (
        await h.call('POST', 'widget/conversations', {
          user: 'long',
          body: { inbox: 'support', type: 'bug', body: 'Broken' },
        })
      ).status
    ).toBe(201);
    const [contact] = await h.find('contact');
    expect(contact?.email).toBeNull();
  });
});
