import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { signIdentityToken } from '../src';
import {
  ago,
  createHarness,
  DAY,
  HOUR,
  IDENTITY_SECRET,
  MINUTE,
  WWW_ORIGIN,
} from './harness';

const h = createHarness();
const orgA = { id: 'org-a', name: 'Org A' };
const orgB = { id: 'org-b', name: 'Org B' };

beforeEach(() => h.reset());
afterAll(() => h.close());

async function conversationCompanies() {
  const companies = await h.find('company');
  return (await h.find('conversation'))
    .map(c => ({
      context: c.context as { url?: string } | null,
      company: companies.find(co => co.id === c.companyId)?.externalOrgId,
    }))
    .filter(row => row.company !== undefined);
}

async function openBug(user: string, extra: Record<string, unknown> = {}) {
  const res = await h.call('POST', 'widget/conversations', {
    user,
    body: {
      inbox: 'support',
      type: 'bug',
      subject: 'Export broken',
      body: 'The CSV export fails',
      context: { url: 'https://app.test/controls/42', host: { control: '42' } },
      ...extra,
    },
  });
  expect(res.status).toBe(201);
  return res.data.conversation as { id: string; reference: string };
}

describe('in-app conversations', () => {
  it('stores the report with its context and queues the agent notification', async () => {
    h.addUser('ada', { orgs: [orgA] });
    const conversation = await openBug('ada', { orgId: orgA.id });

    expect(conversation.reference).toMatch(/^DG-\d+$/);
    const [row] = await conversationCompanies();
    expect(row?.context?.url).toBe('https://app.test/controls/42');
    expect(row?.company).toBe(orgA.id);
    const jobs = await h.find('job');
    expect(jobs.map(j => j.kind)).toEqual(['notify-agents']);
  });

  it('titles a report without a subject from its first line', async () => {
    h.addUser('ada');
    const res = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: {
        inbox: 'support',
        type: 'bug',
        body: 'Export fails\nfull details',
      },
    });
    expect(res.status).toBe(201);
    const row = await h.findOne('conversation');
    expect(row?.subject).toBe('Export fails');
  });

  it('refuses an organization the caller is not a member of', async () => {
    h.addUser('ada', { orgs: [orgA] });
    const res = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: { inbox: 'support', type: 'question', body: 'hi', orgId: orgB.id },
    });
    expect(res.status).toBe(403);
    expect(await h.count('conversation')).toBe(0);
  });

  it('refuses anonymous posts to a non-public inbox', async () => {
    const res = await h.call('POST', 'widget/conversations', {
      body: {
        inbox: 'support',
        type: 'question',
        body: 'hi',
        email: 'x@y.test',
      },
    });
    expect(res.status).toBe(401);
  });
});

describe('seen by an agent', () => {
  it('tells the customer when an agent has opened their latest message', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const conversation = await openBug('ada');
    const thread = () =>
      h.call('GET', `widget/conversations/${conversation.id}`, { user: 'ada' });

    expect((await thread()).data.conversation.agentSeenAt).toBeNull();
    await h.call('GET', `agent/conversations/${conversation.id}`, {
      user: 'agent',
    });
    const seen = (await thread()).data;
    expect(seen.conversation.agentSeenAt).toBe(seen.messages[0].createdAt);
  });
});

describe('visibility', () => {
  it('keeps a conversation private to its author by default', async () => {
    h.addUser('ada', { orgs: [orgA] });
    h.addUser('bob', { orgs: [orgA] });
    const conversation = await openBug('ada', { orgId: orgA.id });

    expect(
      (
        await h.call('GET', `widget/conversations/${conversation.id}`, {
          user: 'bob',
        })
      ).status
    ).toBe(404);
    const session = await h.call('GET', 'widget/session', { user: 'bob' });
    expect(session.data.conversations).toEqual([]);
  });

  it('shows a shared conversation to active members of that organization only', async () => {
    h.addUser('ada', { orgs: [orgA] });
    h.addUser('bob', { orgs: [orgA] });
    h.addUser('eve', { orgs: [orgB] });
    const conversation = await openBug('ada', {
      orgId: orgA.id,
      sharedWithCompany: true,
    });

    expect(
      (
        await h.call('GET', `widget/conversations/${conversation.id}`, {
          user: 'bob',
        })
      ).status
    ).toBe(200);
    expect(
      (
        await h.call('GET', `widget/conversations/${conversation.id}`, {
          user: 'eve',
        })
      ).status
    ).toBe(404);

    h.addUser('bob', { orgs: [] });
    expect(
      (
        await h.call('GET', `widget/conversations/${conversation.id}`, {
          user: 'bob',
        })
      ).status
    ).toBe(404);
  });

  it('lets a teammate reply to a shared conversation before ever writing to support', async () => {
    h.addUser('ada', { orgs: [orgA] });
    h.addUser('bob', { orgs: [orgA] });
    const conversation = await openBug('ada', {
      orgId: orgA.id,
      sharedWithCompany: true,
    });

    const reply = await h.call(
      'POST',
      `widget/conversations/${conversation.id}/messages`,
      { user: 'bob', body: { body: 'Same here' } }
    );

    expect(reply.status).toBe(201);
    expect(await h.count('message', { body: 'Same here' })).toBe(1);
  });

  it('lets only the author change sharing', async () => {
    h.addUser('ada', { orgs: [orgA] });
    h.addUser('bob', { orgs: [orgA] });
    const conversation = await openBug('ada', {
      orgId: orgA.id,
      sharedWithCompany: true,
    });
    const res = await h.call(
      'PATCH',
      `widget/conversations/${conversation.id}`,
      {
        user: 'bob',
        body: { sharedWithCompany: false },
      }
    );
    expect(res.status).toBe(403);
  });

  it('lets the author mark a conversation resolved, once, and nobody else', async () => {
    h.addUser('ada', { orgs: [orgA] });
    h.addUser('bob', { orgs: [orgA] });
    h.addUser('agent', { isAgent: true });
    const conversation = await openBug('ada', {
      orgId: orgA.id,
      sharedWithCompany: true,
    });
    await h.call('PATCH', `agent/conversations/${conversation.id}`, {
      user: 'agent',
      body: {
        snoozedUntil: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    const resolve = (user: string) =>
      h.call('PATCH', `widget/conversations/${conversation.id}`, {
        user,
        body: { status: 'resolved' },
      });

    expect((await resolve('bob')).status).toBe(403);
    expect(
      (
        await h.call('PATCH', `widget/conversations/${conversation.id}`, {
          user: 'ada',
          body: {},
        })
      ).status
    ).toBe(400);
    expect((await resolve('ada')).status).toBe(200);
    const resolvedAt =
      (await h.findOne('conversation', { id: conversation.id }))?.resolvedAt ??
      null;
    expect((await resolve('ada')).status).toBe(200);

    expect(resolvedAt).not.toBeNull();
    expect(
      (await h.find('conversation', { id: conversation.id })).map(r => ({
        status: r.status,
        resolvedAt: r.resolvedAt,
        waitingSince: r.waitingSince,
        snoozedUntil: r.snoozedUntil,
      }))
    ).toEqual([
      {
        status: 'resolved',
        resolvedAt,
        waitingSince: null,
        snoozedUntil: null,
      },
    ]);
    expect(
      (
        await h.find(
          'conversation_event',
          {
            conversationId: conversation.id,
            kind: ['status', 'snoozedUntil'],
            agentId: null,
          },
          { orderBy: { kind: 'asc' } }
        )
      ).map(r => ({
        kind: r.kind,
        agentId: r.agentId,
        by: r.data.by ?? null,
      }))
    ).toEqual([
      { kind: 'snoozedUntil', agentId: null, by: 'customer' },
      { kind: 'status', agentId: null, by: 'customer' },
    ]);
    const thread = await h.call(
      'GET',
      `widget/conversations/${conversation.id}`,
      { user: 'ada' }
    );
    expect(thread.data.conversation.status).toBe('resolved');
  });

  it('takes one rating from the author of a resolved conversation, and a bad one reopens it', async () => {
    h.addUser('ada', { orgs: [orgA] });
    h.addUser('bob', { orgs: [orgA] });
    h.addUser('agent', { isAgent: true });
    const conversation = await openBug('ada', {
      orgId: orgA.id,
      sharedWithCompany: true,
    });
    const rate = (user: string, body: Record<string, unknown>) =>
      h.call('POST', `widget/conversations/${conversation.id}/rating`, {
        user,
        body,
      });

    expect((await rate('ada', { rating: 'good' })).status).toBe(409);
    await h.call('PATCH', `widget/conversations/${conversation.id}`, {
      user: 'ada',
      body: { status: 'resolved' },
    });
    expect((await rate('bob', { rating: 'good' })).status).toBe(403);
    expect((await rate('ada', { rating: 'meh' })).status).toBe(400);
    const res = await rate('ada', { rating: 'bad', comment: ' Still broken ' });
    expect(res.status).toBe(200);
    expect(res.data.conversation).toMatchObject({
      rating: 'bad',
      status: 'open',
    });
    await h.call('PATCH', `agent/conversations/${conversation.id}`, {
      user: 'agent',
      body: { status: 'resolved' },
    });
    expect((await rate('ada', { rating: 'good' })).status).toBe(409);

    const row = await h.findOne('conversation', { id: conversation.id });
    expect({
      rating: row?.rating,
      ratingComment: row?.ratingComment,
      rated: row?.ratedAt != null,
    }).toEqual({
      rating: 'bad',
      ratingComment: 'Still broken',
      rated: true,
    });
    expect(
      (
        await h.find(
          'conversation_event',
          { conversationId: conversation.id, kind: ['rating', 'status'] },
          { orderBy: { createdAt: 'asc', kind: 'asc' } }
        )
      ).map(r => ({
        kind: r.kind,
        to: r.data.to ?? null,
        by: r.data.by ?? null,
      }))
    ).toEqual([
      { kind: 'status', to: 'resolved', by: 'customer' },
      { kind: 'rating', to: 'bad', by: 'customer' },
      { kind: 'status', to: 'open', by: 'customer' },
      { kind: 'status', to: 'resolved', by: null },
    ]);
    const bad = await h.call('GET', 'agent/conversations?status=rated-bad', {
      user: 'agent',
    });
    expect(bad.data.conversations.map((c: { id: string }) => c.id)).toEqual([
      conversation.id,
    ]);
  });

  it('never exposes internal notes to the customer', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const conversation = await openBug('ada');
    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'secret note', internal: true },
    });
    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'public reply' },
    });
    const res = await h.call('GET', `widget/conversations/${conversation.id}`, {
      user: 'ada',
    });
    expect(res.data.messages.map((m: { body: string }) => m.body)).toEqual([
      'The CSV export fails',
      'public reply',
    ]);
  });
});

describe('last seen', () => {
  async function lastSeen(email: string) {
    const row = await h.findOne('contact', { email });
    return row?.lastSeenAt?.getTime() ?? null;
  }

  async function age(email: string, ms: number) {
    await h.update('contact', { email }, { lastSeenAt: ago(ms) });
    return lastSeen(email);
  }

  it('records a signed-in customer, and writes again only after a few minutes', async () => {
    h.addUser('ada', { email: 'ada@harbor.test' });
    await openBug('ada');
    expect(await lastSeen('ada@harbor.test')).toEqual(expect.any(Number));

    const recent = await age('ada@harbor.test', 2 * MINUTE);
    await h.call('GET', 'widget/session?inbox=support', { user: 'ada' });
    expect(await lastSeen('ada@harbor.test')).toEqual(recent);

    const stale = await age('ada@harbor.test', 10 * MINUTE);
    await h.call('GET', 'widget/session?inbox=support', { user: 'ada' });
    expect(await lastSeen('ada@harbor.test')).toBeGreaterThan(
      stale ?? Number.POSITIVE_INFINITY
    );
  });

  it('records a visitor when they write and when their token comes back', async () => {
    const created = await h.call('POST', 'widget/conversations', {
      body: {
        inbox: 'sales',
        type: 'lead',
        body: 'Pricing?',
        email: 'buyer@example.test',
      },
    });
    expect(await lastSeen('buyer@example.test')).toEqual(expect.any(Number));

    const stale = await age('buyer@example.test', DAY);
    await h.call('GET', 'widget/session?inbox=sales', {
      headers: { 'x-helpdesk-visitor': created.data.visitorToken },
    });
    expect(await lastSeen('buyer@example.test')).toBeGreaterThan(
      stale ?? Number.POSITIVE_INFINITY
    );
  });

  it('keeps the later of the two when contacts merge', async () => {
    const a = await h.support.store.createContact({ email: 'a@harbor.test' });
    const b = await h.support.store.createContact({ email: 'b@harbor.test' });
    const later = await age('b@harbor.test', HOUR);
    await h.support.store.mergeContacts(a.id, b.id);
    expect(await lastSeen('a@harbor.test')).toEqual(later);
  });
});

describe('anonymous visitors', () => {
  const salesBody = {
    inbox: 'sales',
    type: 'lead',
    body: 'Pricing for 50 seats?',
    email: 'Buyer@Example.test',
    name: 'Buyer',
  };

  it('scopes a visitor to their own conversation by token', async () => {
    const created = await h.call('POST', 'widget/conversations', {
      body: salesBody,
    });
    const token = created.data.visitorToken as string;
    expect(token).toHaveLength(43);

    const own = await h.call(
      'GET',
      `widget/conversations/${created.data.conversation.id}`,
      {
        headers: { 'x-helpdesk-visitor': token },
      }
    );
    expect(own.status).toBe(200);

    const other = await h.call('POST', 'widget/conversations', {
      body: salesBody,
    });
    const leak = await h.call(
      'GET',
      `widget/conversations/${other.data.conversation.id}`,
      {
        headers: { 'x-helpdesk-visitor': token },
      }
    );
    expect(leak.status).toBe(404);
    expect(
      (
        await h.call(
          'GET',
          `widget/conversations/${created.data.conversation.id}`
        )
      ).status
    ).toBe(404);
  });

  it('never attaches a typed email to an existing verified contact', async () => {
    h.addUser('ceo', { email: 'buyer@example.test' });
    const inApp = await openBug('ceo');

    const created = await h.call('POST', 'widget/conversations', {
      body: salesBody,
    });
    const token = created.data.visitorToken as string;
    const session = await h.call('GET', 'widget/session', {
      headers: { 'x-helpdesk-visitor': token },
    });
    expect(session.data.conversations.map((c: { id: string }) => c.id)).toEqual(
      [created.data.conversation.id]
    );
    expect(
      (
        await h.call('GET', `widget/conversations/${inApp.id}`, {
          headers: { 'x-helpdesk-visitor': token },
        })
      ).status
    ).toBe(404);
    expect(await h.count('contact')).toBe(2);
  });

  it('opens a new contact when the same browser types another address', async () => {
    const first = await h.call('POST', 'widget/conversations', {
      body: salesBody,
    });
    const token = first.data.visitorToken as string;
    const second = await h.call('POST', 'widget/conversations', {
      body: { ...salesBody, email: 'someone.else@example.test' },
      headers: { 'x-helpdesk-visitor': token },
    });
    expect(second.data.visitorToken).not.toBe(token);
    const contacts = await h.find('contact');
    const owners = (
      await h.find('conversation', {}, { orderBy: { createdAt: 'asc' } })
    ).flatMap(c => contacts.filter(ct => ct.id === c.contactId));
    expect(owners.map(o => o.email)).toEqual([
      'buyer@example.test',
      'someone.else@example.test',
    ]);
  });

  it('marks sales visitors as leads', async () => {
    await h.call('POST', 'widget/conversations', { body: salesBody });
    const [contact] = (await h.find('contact')).map(r => ({
      leadStage: r.leadStage,
      email: r.email,
    }));
    expect(contact).toEqual({
      leadStage: 'lead',
      email: 'buyer@example.test',
    });
  });

  it('gives a sales visitor the first configured lead stage, or none', async () => {
    for (const [leadStages, expected] of [
      [['prospect', 'customer'], 'prospect'],
      [[], null],
    ] as const) {
      await h.reset();
      const custom = createHarness({ leadStages: [...leadStages] });
      try {
        await custom.call('POST', 'widget/conversations', { body: salesBody });
        expect(
          (await h.find('contact')).map(r => ({ leadStage: r.leadStage }))
        ).toEqual([{ leadStage: expected }]);
      } finally {
        await custom.close();
      }
    }
  });

  it('drops honeypot submissions without storing anything', async () => {
    const res = await h.call('POST', 'widget/conversations', {
      body: { ...salesBody, website: 'http://spam.test' },
    });
    expect(res.status).toBe(201);
    expect(await h.count('conversation')).toBe(0);
  });

  it('tells the widget whether uploads are available', async () => {
    const session = await h.call('GET', 'widget/session?inbox=sales');
    expect(session.data.uploads).toBe(true);
    const bare = createHarness({ storage: undefined });
    try {
      const without = await bare.call('GET', 'widget/session?inbox=sales');
      expect(without.data.uploads).toBe(false);
    } finally {
      await bare.close();
    }
  });

  it('rate-limits anonymous posts per IP', async () => {
    const limited = createHarness({ anonymousRateLimit: 2 });
    try {
      const post = () =>
        limited.call('POST', 'widget/conversations', {
          body: salesBody,
          headers: { 'x-real-ip': '203.0.113.9' },
        });
      expect((await post()).status).toBe(201);
      expect((await post()).status).toBe(201);
      expect((await post()).status).toBe(429);
      expect(await h.count('conversation')).toBe(2);
    } finally {
      await limited.close();
    }
  });
});

describe('identity merging', () => {
  it('merges a host user into the contact that proved the same email first', async () => {
    h.addUser('first', { email: 'same@example.test' });
    await openBug('first');
    h.addUser('second', { email: 'same@example.test' });
    await openBug('second');
    expect(await h.count('contact')).toBe(1);
  });

  it('does not merge on an unverified host email', async () => {
    h.addUser('first', { email: 'same@example.test' });
    await openBug('first');
    h.addUser('second', { email: 'same@example.test', emailVerified: false });
    await openBug('second');
    expect(await h.count('contact')).toBe(2);
  });
});

describe('request guards', () => {
  it('refuses a non-JSON mutation', async () => {
    h.addUser('ada');
    const res = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      headers: { 'content-type': 'text/plain' },
      body: { inbox: 'support', type: 'question', body: 'hi' },
    });
    expect(res.status).toBe(415);
  });

  it('refuses a cross-origin agent mutation', async () => {
    h.addUser('agent', { isAgent: true });
    const res = await h.call('POST', 'agent/canned', {
      user: 'agent',
      headers: { origin: 'https://evil.test' },
      body: { title: 't', body: 'b' },
    });
    expect(res.status).toBe(403);
  });

  it('answers CORS only for an allowed origin', async () => {
    const allowed = await h.call('OPTIONS', 'widget/conversations', {
      headers: { origin: WWW_ORIGIN },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe(WWW_ORIGIN);
    const denied = await h.call('OPTIONS', 'widget/conversations', {
      headers: { origin: 'https://evil.test' },
    });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    const patch = await h.call(
      'OPTIONS',
      'widget/conversations/00000000-0000-0000-0000-000000000000',
      { headers: { origin: WWW_ORIGIN } }
    );
    expect(patch.headers.get('access-control-allow-methods')).toContain(
      'PATCH'
    );
  });

  it('refuses a malformed conversation id without a server error', async () => {
    h.addUser('ada');
    expect(
      (await h.call('GET', 'widget/conversations/not-a-uuid', { user: 'ada' }))
        .status
    ).toBe(404);
  });
});

describe('attachments', () => {
  it('only serves an upload that landed, and only to someone who can see the conversation', async () => {
    h.addUser('ada');
    h.addUser('bob');
    const conversation = await openBug('ada');
    const start = await h.call(
      'POST',
      `widget/conversations/${conversation.id}/attachments`,
      {
        user: 'ada',
        body: { filename: 'shot.png', contentType: 'image/png', size: 1000 },
      }
    );
    expect(start.status).toBe(201);
    const id = start.data.id as string;

    const early = await h.call(
      'POST',
      `widget/conversations/${conversation.id}/attachments/${id}/complete`,
      { user: 'ada', body: {} }
    );
    expect(early.status).toBe(409);

    h.objects.set(start.data.upload.fields.key, new Uint8Array([1]));
    const done = await h.call(
      'POST',
      `widget/conversations/${conversation.id}/attachments/${id}/complete`,
      { user: 'ada', body: {} }
    );
    expect(done.status).toBe(200);

    const own = await h.support.handler(
      new Request(
        `https://app.test/api/helpdesk/widget/conversations/${conversation.id}/attachments/${id}`,
        {
          headers: { 'x-test-user': 'ada' },
        }
      )
    );
    expect(own.status).toBe(302);
    const other = await h.call(
      'GET',
      `widget/conversations/${conversation.id}/attachments/${id}`,
      { user: 'bob' }
    );
    expect(other.status).toBe(404);
    // Through a conversation Bob can see, the file is still not his.
    const bobs = await openBug('bob');
    const borrowed = await h.call(
      'GET',
      `widget/conversations/${bobs.id}/attachments/${id}`,
      { user: 'bob' }
    );
    expect(borrowed.status).toBe(404);

    h.addUser('agent', { isAgent: true });
    const agent = (conversationId: string, user = 'agent') =>
      h.call('GET', `agent/conversations/${conversationId}/attachments/${id}`, {
        user,
      });
    expect((await agent(conversation.id)).status).toBe(302);
    expect((await agent(bobs.id)).status).toBe(404);
    expect((await agent(conversation.id, 'ada')).status).toBe(403);
  });

  it('refuses an executable content type', async () => {
    h.addUser('ada');
    const conversation = await openBug('ada');
    const res = await h.call(
      'POST',
      `widget/conversations/${conversation.id}/attachments`,
      {
        user: 'ada',
        body: { filename: 'x.html', contentType: 'text/html', size: 10 },
      }
    );
    expect(res.status).toBe(400);
  });
});

describe('attachment limits', () => {
  it('caps the files one conversation can hold', async () => {
    h.addUser('ada');
    const conversation = await openBug('ada');
    const start = () =>
      h.call('POST', `widget/conversations/${conversation.id}/attachments`, {
        user: 'ada',
        body: { filename: 'a.png', contentType: 'image/png', size: 10 },
      });
    for (let i = 0; i < 20; i++) expect((await start()).status).toBe(201);
    expect((await start()).status).toBe(429);
  });
});

describe('first-message qualification', () => {
  it('tags the contact with a known segment and refuses an unknown one', async () => {
    const qualified = createHarness({
      inboxes: {
        sales: {
          public: true,
          defaultPriority: 'high',
          qualify: {
            label: { en: 'You are', de: 'Sie sind', fr: 'Vous êtes' },
            options: [
              {
                value: 'consultancy',
                label: { en: 'Consultancy', de: 'Beratung', fr: 'Conseil' },
              },
            ],
          },
        },
      },
    });
    try {
      const body = {
        inbox: 'sales',
        type: 'lead',
        body: 'Hi',
        email: 'x@y.test',
      };
      expect(
        (
          await qualified.call('POST', 'widget/conversations', {
            body: { ...body, segment: 'bogus' },
          })
        ).status
      ).toBe(400);
      expect(
        (
          await qualified.call('POST', 'widget/conversations', {
            body: { ...body, segment: 'consultancy' },
          })
        ).status
      ).toBe(201);
      const rows = await Promise.all(
        (await h.find('conversation')).map(async v => ({
          tags: v.contactId
            ? (await h.support.store.getContact(v.contactId))?.tags
            : undefined,
          priority: v.priority,
        }))
      );
      const [row] = rows.filter(r => r.tags !== undefined);
      expect(row).toEqual({ tags: ['consultancy'], priority: 'high' });
    } finally {
      await qualified.close();
    }
  });
});

describe('what an unproven visitor can reach', () => {
  const lead = {
    inbox: 'sales',
    type: 'lead',
    body: 'Hello',
    email: 'ceo@victim.test',
  };

  it('loses its token when an agent merges a real customer into the lead', async () => {
    h.addUser('ada', { email: 'ceo@victim.test' });
    h.addUser('agent', { isAgent: true });
    const typed = await h.call('POST', 'widget/conversations', { body: lead });
    const token = typed.data.visitorToken as string;
    await openBug('ada');
    const host = await h.findOne('identity', { channel: 'host' });
    const leadContact = await h.findOne('conversation', {
      id: typed.data.conversation.id,
    });
    await h.call('POST', `agent/contacts/${leadContact?.contactId}/merge`, {
      user: 'agent',
      body: { sourceId: host?.contactId },
    });

    const session = await h.call('GET', 'widget/session?inbox=sales', {
      headers: { 'x-helpdesk-visitor': token },
    });
    expect(session.data.conversations).toHaveLength(0);
  });

  it('cannot share into a company an agent linked the thread to', async () => {
    h.addUser('agent', { isAgent: true });
    const typed = await h.call('POST', 'widget/conversations', { body: lead });
    const company = await h.support.store.createCompany({ name: 'Victim' });
    await h.call('PATCH', `agent/conversations/${typed.data.conversation.id}`, {
      user: 'agent',
      body: { companyId: company.id },
    });
    const share = await h.call(
      'PATCH',
      `widget/conversations/${typed.data.conversation.id}`,
      {
        headers: { 'x-helpdesk-visitor': typed.data.visitorToken },
        body: { sharedWithCompany: true },
      }
    );
    expect(share.status).toBe(403);
  });

  it('gets agent replies under a neutral subject until the address is proven', async () => {
    h.addUser('agent', { isAgent: true });
    const typed = await h.call('POST', 'widget/conversations', {
      body: { ...lead, subject: 'Your account is suspended' },
    });
    await h.call(
      'POST',
      `agent/conversations/${typed.data.conversation.id}/messages`,
      { user: 'agent', body: { body: 'Hi there' } }
    );
    await h.runDueJobs();
    const reply = h.emails.find(e => e.kind === 'customer-reply');
    expect(reply).toBeDefined();
    expect(JSON.stringify(reply)).not.toContain('suspended');
  });

  it('counts follow-up messages against the anonymous limit', async () => {
    const limited = createHarness({ anonymousRateLimit: 2 });
    try {
      const typed = await limited.call('POST', 'widget/conversations', {
        body: lead,
      });
      const send = () =>
        limited.call(
          'POST',
          `widget/conversations/${typed.data.conversation.id}/messages`,
          {
            headers: { 'x-helpdesk-visitor': typed.data.visitorToken },
            body: { body: 'again' },
          }
        );
      expect((await send()).status).toBe(201);
      expect((await send()).status).toBe(429);
    } finally {
      await limited.close();
    }
  });

  it('attaches files to its own thread only', async () => {
    h.addUser('ada', { orgs: [orgA] });
    h.addUser('bob', { orgs: [orgA] });
    const conversation = await openBug('ada', {
      orgId: orgA.id,
      sharedWithCompany: true,
    });
    const upload = await h.call(
      'POST',
      `widget/conversations/${conversation.id}/attachments`,
      {
        user: 'bob',
        body: { filename: 'x.png', contentType: 'image/png', size: 10 },
      }
    );
    expect(upload.status).toBe(403);
  });

  it('answers a malformed path escape without throwing', async () => {
    const res = await h.call('GET', 'widget/conversations/%E0/');
    expect(res.status).toBeLessThan(500);
  });
});

describe('host identity tokens', () => {
  const claims = {
    sub: 'host-user-42',
    email: 'grace@example.test',
    email_verified: true,
    name: 'Grace',
    orgs: [orgB],
  };
  const asHost = (token: string) => ({
    'x-helpdesk-identity': token,
    origin: WWW_ORIGIN,
  });

  it('opens a conversation in a signed-in inbox as the user the host vouches for', async () => {
    const headers = asHost(signIdentityToken(claims, IDENTITY_SECRET));
    const created = await h.call('POST', 'widget/conversations', {
      headers,
      body: { inbox: 'support', type: 'question', body: 'Hi', orgId: orgB.id },
    });
    expect(created.status).toBe(201);

    const session = await h.call('GET', 'widget/session', { headers });
    expect(session.data).toMatchObject({
      identified: true,
      name: 'Grace',
      email: 'grace@example.test',
      agent: null,
    });
    expect(session.data.conversations).toHaveLength(1);
    const [row] = await conversationCompanies();
    expect(row?.company).toBe(orgB.id);
  });

  it('rejects a forged, tampered or expired token', async () => {
    const valid = signIdentityToken(claims, IDENTITY_SECRET);
    const [header, , signature] = valid.split('.');
    const tampered = `${header}.${Buffer.from(
      JSON.stringify({ ...claims, sub: 'someone-else', exp: 4102444800 })
    ).toString('base64url')}.${signature}`;
    for (const token of [
      signIdentityToken(claims, 'not-the-secret'),
      tampered,
      signIdentityToken(claims, IDENTITY_SECRET, { expiresInSeconds: -1 }),
      'not.a.jwt',
    ]) {
      const res = await h.call('POST', 'widget/conversations', {
        headers: asHost(token),
        body: { inbox: 'sales', type: 'lead', body: 'Hi' },
      });
      expect(res.status).toBe(401);
    }
    expect(await h.count('conversation')).toBe(0);
  });

  it('never grants the agent API', async () => {
    const res = await h.call('GET', 'agent/conversations', {
      headers: {
        'x-helpdesk-identity': signIdentityToken(claims, IDENTITY_SECRET),
      },
    });
    expect(res.status).toBe(401);
  });
});

describe('rating from the email', () => {
  async function resolvedReply(user: string) {
    h.addUser(user);
    h.addUser('agent', { isAgent: true });
    const conversation = await openBug(user);
    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'Fixed in the latest release.' },
    });
    await h.call('PATCH', `agent/conversations/${conversation.id}`, {
      user: 'agent',
      body: { status: 'resolved' },
    });
    await h.runDueJobs();
    const email = h.emails.find(e => e.kind === 'customer-reply');
    if (email?.kind !== 'customer-reply') throw new Error('no reply email');
    return { conversation, links: email.ratingLinks };
  }
  const open = (url: string, method = 'GET') =>
    h.support.handler(new Request(url, { method }));
  const rating = async (id: string) =>
    (await h.find('conversation', { id })).map(r => ({
      rating: r.rating,
      status: r.status,
    }))[0];

  it('records a rating once, from the button on the page the link opens', async () => {
    const { conversation, links } = await resolvedReply('ada');
    if (!links) throw new Error('no rating links');

    const landing = await open(links.good);
    expect(landing.status).toBe(200);
    expect(await landing.text()).toContain('<form method="post">');
    // A mail scanner opening every link casts nothing.
    await open(links.bad);
    expect(await rating(conversation.id)).toEqual({
      rating: null,
      status: 'resolved',
    });

    const done = await open(links.good, 'POST');
    expect(done.status).toBe(200);
    expect(await done.text()).toContain('Thank you for rating');
    expect(await rating(conversation.id)).toEqual({
      rating: 'good',
      status: 'resolved',
    });
    expect(await (await open(links.bad, 'POST')).text()).toContain(
      'has been rated already'
    );
    expect(await rating(conversation.id)).toMatchObject({ rating: 'good' });

    const forged = new URL(links.good);
    forged.searchParams.set('r', 'bad');
    expect((await open(forged.toString(), 'POST')).status).toBe(404);
  });

  it('refuses an expired link, and offers no button once the conversation is open again', async () => {
    const { conversation, links } = await resolvedReply('dora');
    if (!links) throw new Error('no rating links');
    vi.useFakeTimers({ now: Date.now() + 31 * 86_400_000, toFake: ['Date'] });
    try {
      expect((await open(links.good)).status).toBe(404);
    } finally {
      vi.useRealTimers();
    }
    await h.call('PATCH', `agent/conversations/${conversation.id}`, {
      user: 'agent',
      body: { status: 'open' },
    });
    const reopened = await open(links.good);
    expect(reopened.status).toBe(409);
    expect(await reopened.text()).not.toContain('<form');
  });

  it('opens the conversation again for a bad rating', async () => {
    const { conversation, links } = await resolvedReply('bob');
    if (!links) throw new Error('no rating links');
    await open(links.bad, 'POST');
    expect(await rating(conversation.id)).toEqual({
      rating: 'bad',
      status: 'open',
    });
  });

  it('adds no rating links to a reply on an open conversation', async () => {
    h.addUser('cleo');
    h.addUser('agent', { isAgent: true });
    const conversation = await openBug('cleo');
    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'Looking into it.' },
    });
    await h.runDueJobs();
    const email = h.emails.find(e => e.kind === 'customer-reply');
    expect(
      email && 'ratingLinks' in email ? email.ratingLinks : undefined
    ).toBeUndefined();
  });
});
