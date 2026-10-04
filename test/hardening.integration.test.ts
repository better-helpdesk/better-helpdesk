import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import type { InboundMessage } from '../src';
import { createHarness } from './harness';

const h = createHarness({ customerRateLimit: 5 });
const orgA = { id: 'org-a', name: 'Org A' };
const orgB = { id: 'org-b', name: 'Org B' };

beforeEach(() => h.reset());
afterAll(() => h.close());

async function rows<T>(query: ReturnType<typeof sql>) {
  return (await h.support.store.db.execute(query)).rows as T[];
}

const mail = (overrides: Partial<InboundMessage> = {}): InboundMessage => ({
  messageId: `<${Math.random()}@mail.test>`,
  from: { address: 'carol@example.test', name: 'Carol' },
  to: ['support@devguard.test'],
  subject: 'Re: Pricing',
  text: 'A reply',
  references: [],
  verified: true,
  automated: false,
  attachments: [],
  ...overrides,
});

async function lead(email = 'carol@example.test') {
  const res = await h.call('POST', 'widget/conversations', {
    body: {
      inbox: 'sales',
      type: 'lead',
      subject: 'Typed by someone',
      body: 'Words nobody proved',
      email,
    },
  });
  expect(res.status).toBe(201);
  return res.data as {
    conversation: { id: string; reference: string };
    visitorToken: string;
  };
}

describe('automated mail', () => {
  it('keeps an out-of-office as a note that neither reopens the thread nor proves the address', async () => {
    const { conversation } = await lead();
    await h.support.store.db.execute(
      sql`UPDATE helpdesk.conversation SET status = 'resolved', resolved_at = now(), waiting_since = NULL`
    );

    await h.support.handleInbound(
      mail({
        to: [`support+${conversation.reference}@devguard.test`],
        text: 'I am out of office',
        automated: true,
      })
    );

    expect(
      await rows(
        sql`SELECT status, waiting_since FROM helpdesk.conversation WHERE id = ${conversation.id}::uuid`
      )
    ).toEqual([{ status: 'resolved', waiting_since: null }]);
    expect(
      await rows(
        sql`SELECT author_type, internal FROM helpdesk.message WHERE body = 'I am out of office'`
      )
    ).toEqual([{ author_type: 'system', internal: true }]);
    expect(
      await rows(
        sql`SELECT verified FROM helpdesk.identity WHERE channel = 'email'`
      )
    ).toEqual([{ verified: false }]);
  });

  it('drops an unsigned automated mail even when it names a thread', async () => {
    const { conversation } = await lead();
    await h.support.handleInbound(
      mail({
        to: [`support+${conversation.reference}@devguard.test`],
        text: 'Planted note',
        automated: true,
        verified: false,
      })
    );
    expect(
      await rows(
        sql`SELECT 1 FROM helpdesk.message WHERE body = 'Planted note'`
      )
    ).toHaveLength(0);
  });

  it('ignores a signed automated mail from someone not on the thread', async () => {
    const { conversation } = await lead();
    await h.support.handleInbound(
      mail({
        from: { address: 'x@attacker.test' },
        to: [`support+${conversation.reference}@devguard.test`],
        text: '[Reset your password](https://evil.test)',
        automated: true,
      })
    );
    expect(
      await rows(
        sql`SELECT 1 FROM helpdesk.message WHERE author_type = 'system'`
      )
    ).toHaveLength(0);
  });

  it('drops an automated mail that belongs to no thread', async () => {
    await h.support.handleInbound(mail({ automated: true }));
    expect(await rows(sql`SELECT 1 FROM helpdesk.conversation`)).toHaveLength(
      0
    );
  });
});

describe('verification per message', () => {
  it('leaves what a typed address wrote with its own contact when the address belongs to someone proven', async () => {
    h.addUser('carol', { email: 'carol@example.test' });
    await h.call('POST', 'widget/conversations', {
      user: 'carol',
      body: { inbox: 'support', type: 'question', body: 'in-app' },
    });
    const { conversation, visitorToken } = await lead();

    await h.support.handleInbound(
      mail({
        to: [`support+${conversation.reference}@devguard.test`],
        text: 'I never wrote this',
      })
    );

    const messages = await rows<{
      body: string;
      verified: boolean;
      same_contact: boolean;
    }>(sql`
      SELECT m.body, m.verified, m.contact_id = c.contact_id AS same_contact
      FROM helpdesk.message m JOIN helpdesk.conversation c ON c.id = m.conversation_id
      WHERE c.id = ${conversation.id}::uuid ORDER BY m.created_at`);
    expect(messages).toEqual([
      { body: 'Words nobody proved', verified: false, same_contact: true },
      { body: 'I never wrote this', verified: true, same_contact: false },
    ]);

    const thread = await h.call(
      'GET',
      `widget/conversations/${conversation.id}`,
      { user: 'carol' }
    );
    expect(
      thread.data.messages.map((m: { body: string; own: boolean }) => [
        m.body,
        m.own,
      ])
    ).toEqual([
      ['Words nobody proved', false],
      ['I never wrote this', true],
    ]);

    const visitor = await h.call('GET', 'widget/session?inbox=sales', {
      headers: { 'x-helpdesk-visitor': visitorToken },
    });
    expect(visitor.data.conversations).toHaveLength(0);
  });

  it('proves the replying address as a contact of its own, which a later sign-in joins', async () => {
    const { conversation } = await lead();
    await h.support.handleInbound(
      mail({
        to: [`support+${conversation.reference}@devguard.test`],
        text: 'It was me',
      })
    );
    h.addUser('carol', { email: 'carol@example.test' });
    await h.call('POST', 'widget/conversations', {
      user: 'carol',
      body: { inbox: 'support', type: 'question', body: 'in-app' },
    });

    const thread = await h.call(
      'GET',
      `widget/conversations/${conversation.id}`,
      { user: 'carol' }
    );
    expect(
      thread.data.messages.map((m: { body: string; own: boolean }) => [
        m.body,
        m.own,
      ])
    ).toEqual([
      ['Words nobody proved', false],
      ['It was me', true],
    ]);
  });

  it('keeps a typed subject out of replies even after the address is proven', async () => {
    h.addUser('agent', { isAgent: true });
    const { conversation } = await lead();
    await h.support.handleInbound(
      mail({ to: [`support+${conversation.reference}@devguard.test`] })
    );
    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'Happy to help' },
    });
    await h.runDueJobs();

    const reply = h.emails.find(e => e.kind === 'customer-reply');
    expect(reply).toMatchObject({ to: 'carol@example.test' });
    expect(reply && 'subject' in reply ? reply.subject : null).toBeUndefined();
  });
});

describe('removed agents', () => {
  it('stops mailing an agent once removed, and refuses them as assignee', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
    h.addUser('former', { isAgent: true, email: 'former@devguard.test' });
    await h.call('GET', 'agent/me', { user: 'agent' });
    const me = await h.call('GET', 'agent/me', { user: 'former' });
    const formerId = me.data.agent.id as string;
    const assigned = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: { inbox: 'support', type: 'question', body: 'earlier' },
    });
    await h.call(
      'PATCH',
      `agent/conversations/${assigned.data.conversation.id}`,
      { user: 'agent', body: { assigneeId: formerId } }
    );
    h.emails.length = 0;

    expect(
      (
        await h.call('DELETE', `agent/agents/${formerId}`, {
          user: 'agent',
        })
      ).status
    ).toBe(200);

    const conversation = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: { inbox: 'support', type: 'question', body: 'help' },
    });
    await h.support.store.db.execute(
      sql`DELETE FROM helpdesk.job WHERE payload->>'conversationId' = ${assigned.data.conversation.id}`
    );
    await h.runDueJobs();
    expect(h.emails.filter(e => e.kind === 'agent-new').map(e => e.to)).toEqual(
      ['agent@devguard.test']
    );
    expect(
      await rows(
        sql`SELECT assignee_id FROM helpdesk.conversation WHERE id = ${assigned.data.conversation.id}::uuid`
      )
    ).toEqual([{ assignee_id: null }]);
    expect(
      (
        await h.call(
          'PATCH',
          `agent/conversations/${conversation.data.conversation.id}`,
          { user: 'agent', body: { assigneeId: formerId } }
        )
      ).status
    ).toBe(400);
  });

  it('lets the host remove an agent by its user id', async () => {
    h.addUser('former', { isAgent: true, email: 'former@devguard.test' });
    await h.call('GET', 'agent/me', { user: 'former' });
    await h.support.removeAgent('user-former');
    expect(await h.support.store.listAgents()).toEqual([]);
  });
});

describe('budgets', () => {
  it('limits how much a signed-in customer can write in an hour', async () => {
    h.addUser('ada');
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (
          await h.call('POST', 'widget/conversations', {
            user: 'ada',
            body: { inbox: 'support', type: 'question', body: `#${i}` },
          })
        ).status
      );
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });

  it('refuses a sender who keeps opening conversations by mail', async () => {
    let refused = 0;
    for (let i = 0; i < 31; i++) {
      try {
        await h.support.handleInbound(mail({ subject: `#${i}` }));
      } catch {
        refused++;
      }
    }
    expect(refused).toBe(1);
    expect(await rows(sql`SELECT 1 FROM helpdesk.conversation`)).toHaveLength(
      30
    );
  });

  it('drops unsigned mail past its domain’s budget quietly, and refuses signed mail past its own', async () => {
    let refused = 0;
    for (let i = 0; i < 101; i++) {
      try {
        await h.support.handleInbound(
          mail({ from: { address: `x${i}@example.test` }, verified: false })
        );
      } catch {
        refused++;
      }
    }
    expect(refused).toBe(0);
    expect(await rows(sql`SELECT 1 FROM helpdesk.conversation`)).toHaveLength(
      100
    );

    for (let i = 0; i < 101; i++) {
      try {
        await h.support.handleInbound(
          mail({ from: { address: `s${i}@attacker.test` } })
        );
      } catch {
        refused++;
      }
    }
    expect(refused).toBe(1);
  });

  it('keeps a triage budget for the host’s signed-in users that others cannot use up', async () => {
    let calls = 0;
    const ai = createHarness({
      ai: {
        async generate<T>({ schema }: { schema: z.ZodType<T> }) {
          calls++;
          const shape = (
            schema as unknown as { shape: Record<string, unknown> }
          ).shape;
          return (
            'duplicates' in shape
              ? { duplicates: [] }
              : { type: 'bug', priority: 'low', title: 't', summary: 's' }
          ) as T;
        },
      },
    });
    const anonymousLead = () =>
      ai.call('POST', 'widget/conversations', {
        body: {
          inbox: 'sales',
          type: 'lead',
          body: 'anonymous',
          email: 'x@example.test',
        },
      });
    try {
      await anonymousLead();
      await ai.runDueJobs();
      expect(calls).toBeGreaterThan(0);

      calls = 0;
      await ai.support.store.db.execute(
        sql`UPDATE helpdesk.rate_limit SET count = 100 WHERE key = 'triages:other'`
      );
      await anonymousLead();
      await ai.runDueJobs();
      expect(calls).toBe(0);

      ai.addUser('ada');
      await ai.call('POST', 'widget/conversations', {
        user: 'ada',
        body: { inbox: 'support', type: 'question', body: 'signed in' },
      });
      await ai.runDueJobs();
      expect(calls).toBeGreaterThan(0);
    } finally {
      await ai.close();
    }
  });
});

describe('bounded input', () => {
  it('refuses a request body past the limit before parsing it', async () => {
    const res = await h.call('POST', 'widget/conversations', {
      body: {
        inbox: 'sales',
        type: 'lead',
        body: 'hi',
        email: 'x@example.test',
        padding: 'x'.repeat(300 * 1024),
      },
    });
    expect(res.status).toBe(413);
    expect(await rows(sql`SELECT 1 FROM helpdesk.conversation`)).toHaveLength(
      0
    );
  });

  it('refuses context with too many keys', async () => {
    const utm = Object.fromEntries(
      Array.from({ length: 21 }, (_, i) => [`k${i}`, 'v'])
    );
    const res = await h.call('POST', 'widget/conversations', {
      body: {
        inbox: 'sales',
        type: 'lead',
        body: 'hi',
        email: 'x@example.test',
        context: { utm },
      },
    });
    expect(res.status).toBe(400);
  });

  it('keeps up to the cap of a mail’s attachments, serving unknown types as plain bytes', async () => {
    const file = (contentType: string) => ({
      filename: 'f',
      contentType,
      content: new Uint8Array([1]),
    });
    await h.support.handleInbound(
      mail({
        attachments: [
          file('text/html'),
          ...Array.from({ length: 25 }, () => file('image/png')),
        ],
      })
    );
    const stored = await rows<{ content_type: string }>(
      sql`SELECT content_type FROM helpdesk.attachment ORDER BY created_at`
    );
    expect(stored).toHaveLength(20);
    expect(stored.map(a => a.content_type).sort()[0]).toBe(
      'application/octet-stream'
    );
    expect(stored.every(a => a.content_type !== 'text/html')).toBe(true);
  });

  it('ignores a plus-address reference too large for a conversation number', async () => {
    await h.support.handleInbound(
      mail({ to: ['support+DG-99999999999@devguard.test'] })
    );
    expect(await rows(sql`SELECT 1 FROM helpdesk.conversation`)).toHaveLength(
      1
    );
  });
});

describe('smaller hardening', () => {
  it('stops honouring a visitor token left unused for a month', async () => {
    const { visitorToken } = await lead();
    await h.support.store.db.execute(
      sql`UPDATE helpdesk.identity SET last_used_at = now() - interval '31 days' WHERE channel = 'visitor'`
    );
    const session = await h.call('GET', 'widget/session?inbox=sales', {
      headers: { 'x-helpdesk-visitor': visitorToken },
    });
    expect(session.data.conversations).toHaveLength(0);
  });

  it('refuses to change sharing once the thread is with another company', async () => {
    h.addUser('ada', { orgs: [orgA] });
    const created = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: {
        inbox: 'support',
        type: 'question',
        body: 'hi',
        orgId: orgA.id,
      },
    });
    const id = created.data.conversation.id as string;
    const [company] = await h.support.store.companiesByExternalOrgIds([
      orgA.id,
    ]);
    const moved = await h.support.store.upsertCompany(orgB.id, orgB.name);
    await h.support.store.db.execute(
      sql`UPDATE helpdesk.conversation SET company_id = ${moved.id}::uuid WHERE id = ${id}::uuid`
    );
    expect(await h.support.store.setSharing(id, company?.id ?? '', true)).toBe(
      false
    );
    expect(
      await rows(
        sql`SELECT shared_with_company FROM helpdesk.conversation WHERE id = ${id}::uuid`
      )
    ).toEqual([{ shared_with_company: false }]);
  });

  it('still lets the author stop sharing a thread that has no company', async () => {
    h.addUser('ada');
    const created = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: { inbox: 'support', type: 'question', body: 'hi' },
    });
    expect(
      (
        await h.call(
          'PATCH',
          `widget/conversations/${created.data.conversation.id}`,
          { user: 'ada', body: { sharedWithCompany: false } }
        )
      ).status
    ).toBe(200);
  });

  it('deletes what a dropped contact wrote in another organization’s thread', async () => {
    h.addUser('ada', { orgs: [orgB] });
    h.addUser('bob', { orgs: [orgA] });
    h.addUser('agent', { isAgent: true });
    const theirs = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: { inbox: 'support', type: 'question', body: 'a', orgId: orgB.id },
    });
    await h.call('POST', 'widget/conversations', {
      user: 'bob',
      body: { inbox: 'support', type: 'question', body: 'b', orgId: orgA.id },
    });
    const [bob] = await rows<{ id: string }>(
      sql`SELECT id FROM helpdesk.contact WHERE email = 'bob@example.test'`
    );
    await h.call(
      'POST',
      `agent/conversations/${theirs.data.conversation.id}/participants`,
      { user: 'agent', body: { contactId: bob?.id } }
    );
    await h.call(
      'POST',
      `widget/conversations/${theirs.data.conversation.id}/messages`,
      { user: 'bob', body: { body: 'from bob' } }
    );

    await h.support.deleteCompany(orgA.id);

    expect(
      await rows(sql`SELECT 1 FROM helpdesk.message WHERE body = 'from bob'`)
    ).toHaveLength(0);
  });

  it('lets only the uploader complete an upload', async () => {
    h.addUser('ada', { orgs: [orgA] });
    h.addUser('bob', { orgs: [orgA] });
    const created = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: {
        inbox: 'support',
        type: 'question',
        body: 'hi',
        orgId: orgA.id,
        sharedWithCompany: true,
      },
    });
    const id = created.data.conversation.id as string;
    const upload = await h.call(
      'POST',
      `widget/conversations/${id}/attachments`,
      {
        user: 'ada',
        body: { filename: 'a.png', contentType: 'image/png', size: 10 },
      }
    );
    h.objects.set(upload.data.upload.fields.key as string, new Uint8Array([1]));
    expect(
      (
        await h.call(
          'POST',
          `widget/conversations/${id}/attachments/${upload.data.id}/complete`,
          { user: 'bob', body: {} }
        )
      ).status
    ).toBe(403);
  });

  it('shows where every link in an AI draft goes', async () => {
    const ai = createHarness({
      ai: {
        async generate<T>() {
          return { reply: 'Read [our guide](https://evil.test/x).' } as T;
        },
      },
    });
    try {
      ai.addUser('ada');
      ai.addUser('agent', { isAgent: true });
      const created = await ai.call('POST', 'widget/conversations', {
        user: 'ada',
        body: { inbox: 'support', type: 'question', body: 'hi' },
      });
      const draft = await ai.call(
        'POST',
        `agent/conversations/${created.data.conversation.id}/draft`,
        { user: 'agent', body: {} }
      );
      expect(draft.data.text).toBe('Read our guide (https://evil.test/x).');
    } finally {
      await ai.close();
    }
  });
});
