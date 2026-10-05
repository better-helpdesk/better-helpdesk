import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { signIdentityToken } from '../src';
import { createHarness, IDENTITY_SECRET, WWW_ORIGIN } from './harness';

const h = createHarness();
const orgA = { id: 'org-a', name: 'Org A' };
const orgB = { id: 'org-b', name: 'Org B' };

beforeEach(() => h.reset());
afterAll(() => h.close());

async function rows<T>(query: ReturnType<typeof sql>) {
  return (await h.support.store.db.execute(query)).rows as T[];
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
    const [row] = await rows<{ context: { url: string }; company: string }>(
      sql`SELECT c.context, co.external_org_id AS company FROM helpdesk.conversation c JOIN helpdesk.company co ON co.id = c.company_id`
    );
    expect(row?.context.url).toBe('https://app.test/controls/42');
    expect(row?.company).toBe(orgA.id);
    const jobs = await rows<{ kind: string }>(
      sql`SELECT kind FROM helpdesk.job`
    );
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
    const [row] = await rows<{ subject: string }>(
      sql`SELECT subject FROM helpdesk.conversation`
    );
    expect(row?.subject).toBe('Export fails');
  });

  it('refuses an organization the caller is not a member of', async () => {
    h.addUser('ada', { orgs: [orgA] });
    const res = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: { inbox: 'support', type: 'question', body: 'hi', orgId: orgB.id },
    });
    expect(res.status).toBe(403);
    expect(await rows(sql`SELECT 1 FROM helpdesk.conversation`)).toHaveLength(
      0
    );
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
    expect(
      await rows(sql`SELECT 1 FROM helpdesk.message WHERE body = 'Same here'`)
    ).toHaveLength(1);
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
    expect((await resolve('ada')).status).toBe(200);
    const [{ resolved_at: resolvedAt } = { resolved_at: null }] = await rows<{
      resolved_at: string | null;
    }>(
      sql`SELECT resolved_at FROM helpdesk.conversation WHERE id = ${conversation.id}`
    );
    expect((await resolve('ada')).status).toBe(200);

    expect(resolvedAt).not.toBeNull();
    expect(
      await rows(
        sql`SELECT status, resolved_at, waiting_since, snoozed_until
            FROM helpdesk.conversation WHERE id = ${conversation.id}`
      )
    ).toEqual([
      {
        status: 'resolved',
        resolved_at: resolvedAt,
        waiting_since: null,
        snoozed_until: null,
      },
    ]);
    expect(
      await rows(
        sql`SELECT agent_id, data FROM helpdesk.conversation_event
            WHERE conversation_id = ${conversation.id} AND kind = 'status'
              AND data->>'to' = 'resolved'`
      )
    ).toEqual([{ agent_id: null, data: { from: 'pending', to: 'resolved' } }]);
    const thread = await h.call(
      'GET',
      `widget/conversations/${conversation.id}`,
      { user: 'ada' }
    );
    expect(thread.data.conversation.status).toBe('resolved');
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
    const contacts = await rows(sql`SELECT id FROM helpdesk.contact`);
    expect(contacts).toHaveLength(2);
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
    const owners = await rows<{ email: string }>(sql`
      SELECT ct.email FROM helpdesk.conversation c
      JOIN helpdesk.contact ct ON ct.id = c.contact_id ORDER BY c.created_at`);
    expect(owners.map(o => o.email)).toEqual([
      'buyer@example.test',
      'someone.else@example.test',
    ]);
  });

  it('marks sales visitors as leads', async () => {
    await h.call('POST', 'widget/conversations', { body: salesBody });
    const [contact] = await rows<{ lead_stage: string; email: string }>(
      sql`SELECT lead_stage, email FROM helpdesk.contact`
    );
    expect(contact).toEqual({
      lead_stage: 'lead',
      email: 'buyer@example.test',
    });
  });

  it('drops honeypot submissions without storing anything', async () => {
    const res = await h.call('POST', 'widget/conversations', {
      body: { ...salesBody, website: 'http://spam.test' },
    });
    expect(res.status).toBe(201);
    expect(await rows(sql`SELECT 1 FROM helpdesk.conversation`)).toHaveLength(
      0
    );
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
      expect(await rows(sql`SELECT 1 FROM helpdesk.conversation`)).toHaveLength(
        2
      );
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
    expect(await rows(sql`SELECT id FROM helpdesk.contact`)).toHaveLength(1);
  });

  it('does not merge on an unverified host email', async () => {
    h.addUser('first', { email: 'same@example.test' });
    await openBug('first');
    h.addUser('second', { email: 'same@example.test', emailVerified: false });
    await openBug('second');
    expect(await rows(sql`SELECT id FROM helpdesk.contact`)).toHaveLength(2);
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
            label: { en: 'You are', de: 'Sie sind' },
            options: [
              {
                value: 'consultancy',
                label: { en: 'Consultancy', de: 'Beratung' },
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
      const [row] = await rows<{ tags: string[]; priority: string }>(
        sql`SELECT c.tags, v.priority FROM helpdesk.contact c JOIN helpdesk.conversation v ON v.contact_id = c.id`
      );
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
    const [host] = await rows<{ contact_id: string }>(
      sql`SELECT contact_id FROM helpdesk.identity WHERE channel = 'host'`
    );
    const [leadContact] = await rows<{ contact_id: string }>(
      sql`SELECT contact_id FROM helpdesk.conversation WHERE id = ${typed.data.conversation.id}::uuid`
    );
    await h.call('POST', `agent/contacts/${leadContact?.contact_id}/merge`, {
      user: 'agent',
      body: { sourceId: host?.contact_id },
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
    const [row] = await rows<{ company: string }>(
      sql`SELECT co.external_org_id AS company FROM helpdesk.conversation c JOIN helpdesk.company co ON co.id = c.company_id`
    );
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
    expect(await rows(sql`SELECT id FROM helpdesk.conversation`)).toHaveLength(
      0
    );
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
