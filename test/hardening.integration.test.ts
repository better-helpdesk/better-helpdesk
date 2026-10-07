import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import type { InboundMessage } from '../src';
import { ago, createHarness, DAY, HOUR } from './harness';

const h = createHarness({ customerRateLimit: 5 });
const orgA = { id: 'org-a', name: 'Org A' };
const orgB = { id: 'org-b', name: 'Org B' };

beforeEach(() => h.reset());
afterAll(() => h.close());

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
    await h.update(
      'conversation',
      {},
      { status: 'resolved', resolvedAt: new Date(), waitingSince: null }
    );

    await h.support.handleInbound(
      mail({
        to: [`support+${conversation.reference}@devguard.test`],
        text: 'I am out of office',
        automated: true,
      })
    );

    expect(
      (await h.find('conversation', { id: conversation.id })).map(r => ({
        status: r.status,
        waitingSince: r.waitingSince,
      }))
    ).toEqual([{ status: 'resolved', waitingSince: null }]);
    expect(
      (await h.find('message', { body: 'I am out of office' })).map(r => ({
        authorType: r.authorType,
        internal: r.internal,
      }))
    ).toEqual([{ authorType: 'system', internal: true }]);
    expect(
      (await h.find('identity', { channel: 'email' })).map(r => ({
        verified: r.verified,
      }))
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
    expect(await h.count('message', { body: 'Planted note' })).toBe(0);
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
    expect(await h.count('message', { authorType: 'system' })).toBe(0);
  });

  it('drops an automated mail that belongs to no thread', async () => {
    await h.support.handleInbound(mail({ automated: true }));
    expect(await h.count('conversation')).toBe(0);
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

    const owner = await h.findOne('conversation', { id: conversation.id });
    const messages = (
      await h.find(
        'message',
        { conversationId: conversation.id },
        { orderBy: { createdAt: 'asc' } }
      )
    ).map(m => ({
      body: m.body,
      verified: m.verified,
      sameContact: m.contactId === owner?.contactId,
    }));
    expect(messages).toEqual([
      { body: 'Words nobody proved', verified: false, sameContact: true },
      { body: 'I never wrote this', verified: true, sameContact: false },
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

  it('never proves an address a host user signed up with but did not verify', async () => {
    h.addUser('mallory', {
      email: 'carol@example.test',
      emailVerified: false,
    });
    h.addUser('agent', { isAgent: true });
    const created = await h.call('POST', 'widget/conversations', {
      user: 'mallory',
      body: {
        inbox: 'support',
        type: 'question',
        subject: 'Urgent: confirm your bank details',
        body: 'hi',
      },
    });
    const { id, reference } = created.data.conversation;
    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'agent',
      body: { body: 'Sure' },
    });
    await h.runDueJobs();
    const reply = h.emails.find(e => e.kind === 'customer-reply');
    expect(reply && 'subject' in reply ? reply.subject : null).toBeUndefined();

    await h.support.handleInbound(
      mail({ to: [`support+${reference}@devguard.test`] })
    );
    const owner = await h.findOne('conversation', { id });
    expect(
      await h.count('identity', {
        channel: 'email',
        verified: true,
        contactId: owner?.contactId,
      })
    ).toBe(0);
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
    await h.remove('job', {
      id: (await h.find('job'))
        .filter(
          j =>
            (j.payload as { conversationId?: string }).conversationId ===
            assigned.data.conversation.id
        )
        .map(j => j.id),
    });
    await h.runDueJobs();
    expect(h.emails.filter(e => e.kind === 'agent-new').map(e => e.to)).toEqual(
      ['agent@devguard.test']
    );
    expect(
      (await h.find('conversation', { id: assigned.data.conversation.id })).map(
        r => ({ assigneeId: r.assigneeId })
      )
    ).toEqual([{ assigneeId: null }]);
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

  it('mails no agent who has stayed out of the agent UI for a month, until they return', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
    h.addUser('away', { isAgent: true, email: 'away@devguard.test' });
    await h.call('GET', 'agent/me', { user: 'agent' });
    await h.call('GET', 'agent/me', { user: 'away' });
    await h.update(
      'agent',
      { email: 'away@devguard.test' },
      { lastSeenAt: ago(31 * DAY) }
    );
    const ask = (body: string) =>
      h.call('POST', 'widget/conversations', {
        user: 'ada',
        body: { inbox: 'support', type: 'question', body },
      });

    await ask('first');
    await h.runDueJobs();
    expect(h.emails.filter(e => e.kind === 'agent-new').map(e => e.to)).toEqual(
      ['agent@devguard.test']
    );

    h.emails.length = 0;
    await h.call('GET', 'agent/me', { user: 'away' });
    await ask('second');
    await h.runDueJobs();
    expect(
      h.emails
        .filter(e => e.kind === 'agent-new')
        .map(e => e.to)
        .sort()
    ).toEqual(['agent@devguard.test', 'away@devguard.test']);
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
    expect(await h.count('conversation')).toBe(30);
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
    expect(await h.count('conversation')).toBe(100);

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

  it('keeps a thread’s signed replies flowing while its domain is over budget', async () => {
    h.addUser('carol', { email: 'carol@example.test' });
    const created = await h.call('POST', 'widget/conversations', {
      user: 'carol',
      body: { inbox: 'support', type: 'question', body: 'hi' },
    });
    await h.insert('rate_limit', {
      key: 'inbound:signed:@example.test',
      windowStart: new Date(Math.floor(Date.now() / HOUR) * HOUR),
      count: 100,
    });
    await h.support.handleInbound(
      mail({
        to: [`support+${created.data.conversation.reference}@devguard.test`],
        text: 'Still here',
      })
    );
    expect(await h.count('message', { body: 'Still here' })).toBe(1);
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
      await ai.update('rate_limit', { key: 'triages:other' }, { count: 100 });
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
    expect(await h.count('conversation')).toBe(0);
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
    const stored = await h.find(
      'attachment',
      {},
      { orderBy: { createdAt: 'asc' } }
    );
    expect(stored).toHaveLength(20);
    expect(stored.map(a => a.contentType).sort()[0]).toBe(
      'application/octet-stream'
    );
    expect(stored.every(a => a.contentType !== 'text/html')).toBe(true);
  });

  it('ignores a plus-address reference too large for a conversation number', async () => {
    await h.support.handleInbound(
      mail({ to: ['support+DG-99999999999@devguard.test'] })
    );
    expect(await h.count('conversation')).toBe(1);
  });
});

describe('a retried inbound mail', () => {
  const pdf = {
    filename: 'invoice.pdf',
    contentType: 'application/pdf',
    content: new Uint8Array([1, 2, 3]),
  };

  // The first delivery fails on storage; the relay sends the same mail again.
  async function deliverTwice(message: InboundMessage) {
    const put = h.storage.put;
    h.storage.put = async () => {
      h.storage.put = put;
      throw new Error('storage unavailable');
    };
    await expect(h.support.handleInbound(message)).rejects.toThrow(
      'storage unavailable'
    );
    await h.support.handleInbound(message);
  }

  it('opens the conversation with its attachment and notifies agents', async () => {
    await deliverTwice(mail({ attachments: [pdf] }));
    expect(await h.count('conversation')).toBe(1);
    expect(
      (await h.find('attachment')).map(a => ({ filename: a.filename }))
    ).toEqual([{ filename: 'invoice.pdf' }]);
    expect(await h.count('job', { kind: 'notify-agents' })).toBe(1);
  });

  it('adds a reply with its attachment and reopens the resolved thread', async () => {
    const first = mail();
    await h.support.handleInbound(first);
    await h.update('conversation', {}, { status: 'resolved' });
    await h.remove('job', {});
    await deliverTwice(
      mail({ references: [first.messageId], attachments: [pdf] })
    );
    expect(await h.count('message')).toBe(2);
    expect(
      (await h.find('attachment')).map(a => ({ filename: a.filename }))
    ).toEqual([{ filename: 'invoice.pdf' }]);
    expect(
      (await h.find('job', { kind: 'notify-agents' })).map(j => ({
        reopened: (j.payload as { reopened?: boolean }).reopened ?? null,
      }))
    ).toEqual([{ reopened: true }]);
  });
});

describe('blocked senders', () => {
  it('refuses a blocked address in the widget and by email, and keeps their conversations out of the inbox', async () => {
    h.addUser('agent', { isAgent: true });
    const first = await lead('spam@bot.test');
    const [contact] = (await h.find('conversation')).map(c => ({
      id: c.contactId,
    }));
    const inbox = async () =>
      (await h.call('GET', 'agent/conversations?status=any', { user: 'agent' }))
        .data as { conversations: { id: string }[]; counts: { all: number } };
    expect((await inbox()).conversations).toHaveLength(1);

    await h.call('PATCH', `agent/contacts/${contact?.id}`, {
      user: 'agent',
      body: { blocked: true },
    });

    expect((await inbox()).conversations).toEqual([]);
    expect((await inbox()).counts.all).toBe(0);
    expect(
      (await h.call('GET', 'agent/unread', { user: 'agent' })).data.waiting
    ).toBe(0);
    await h.update('conversation', {}, { waitingSince: ago(2 * HOUR) });
    expect(await h.support.store.claimReminders('sales', 1)).toEqual([]);
    const page = await h.call('GET', `agent/contacts/${contact?.id}`, {
      user: 'agent',
    });
    expect(page.data.conversations.map((c: { id: string }) => c.id)).toEqual([
      first.conversation.id,
    ]);

    // A new browser and a new contact, but the same address.
    const again = await h.call('POST', 'widget/conversations', {
      body: {
        inbox: 'sales',
        type: 'lead',
        body: 'Buy now',
        email: 'SPAM@bot.test',
      },
    });
    expect(again.status).toBe(404);
    // Their own browser cannot reply either.
    const reply = await h.call(
      'POST',
      `widget/conversations/${first.conversation.id}/messages`,
      {
        body: { body: 'Still here' },
        headers: { 'x-helpdesk-visitor': first.visitorToken },
      }
    );
    expect(reply.status).toBe(404);
    await h.support.handleInbound(
      mail({ from: { address: 'spam@bot.test', name: 'Bot' }, text: 'By mail' })
    );
    expect(
      (await h.find('message', {}, { orderBy: { createdAt: 'asc' } })).map(
        m => ({ body: m.body })
      )
    ).toEqual([{ body: 'Words nobody proved' }]);

    await h.call('PATCH', `agent/contacts/${contact?.id}`, {
      user: 'agent',
      body: { blocked: false },
    });
    expect((await lead('spam@bot.test')).conversation.id).toBeTruthy();
    expect((await inbox()).conversations).toHaveLength(2);
  });
});

describe('blocked senders, by every address they hold', () => {
  const block = async (email: string) => {
    const [contact] = await h.find('contact', { email });
    await h.call('PATCH', `agent/contacts/${contact?.id}`, {
      user: 'agent',
      body: { blocked: true },
    });
    return contact?.id as string;
  };

  it('refuses an address merged into a blocked contact, by widget and by mail', async () => {
    h.addUser('agent', { isAgent: true });
    await lead('a@spam.test');
    await lead('b@spam.test');
    const [a, b] = await h.find('contact', {}, { orderBy: { email: 'asc' } });
    await h.call('POST', `agent/contacts/${a?.id}/merge`, {
      user: 'agent',
      body: { sourceId: b?.id },
    });
    await block('a@spam.test');

    const res = await h.call('POST', 'widget/conversations', {
      body: {
        inbox: 'sales',
        type: 'lead',
        body: 'Again',
        email: 'b@spam.test',
      },
    });
    expect(res.status).toBe(404);
    await h.support.handleInbound(
      mail({ from: { address: 'b@spam.test', name: 'B' }, text: 'By mail' })
    );
    expect(await h.count('message', { body: ['Again', 'By mail'] })).toBe(0);
  });

  it('keeps the block when a blocked contact is merged into one that is not', async () => {
    h.addUser('agent', { isAgent: true });
    await lead('a@spam.test');
    await lead('b@spam.test');
    const [a, b] = await h.find('contact', {}, { orderBy: { email: 'asc' } });
    await block('b@spam.test');
    await h.call('POST', `agent/contacts/${a?.id}/merge`, {
      user: 'agent',
      body: { sourceId: b?.id },
    });

    expect(
      (await h.find('contact')).map(c => ({
        email: c.email,
        blocked: c.blocked,
      }))
    ).toEqual([{ email: 'a@spam.test', blocked: true }]);
    for (const email of ['a@spam.test', 'b@spam.test']) {
      const res = await h.call('POST', 'widget/conversations', {
        body: { inbox: 'sales', type: 'lead', body: 'Again', email },
      });
      expect(res.status).toBe(404);
    }
  });

  it('refuses a signed-in customer whose address was blocked', async () => {
    h.addUser('agent', { isAgent: true });
    await lead('spam@spam.test');
    await block('spam@spam.test');
    h.addUser('spammer', { email: 'spam@spam.test' });
    const res = await h.call('POST', 'widget/conversations', {
      user: 'spammer',
      body: { inbox: 'support', type: 'question', body: 'Signed up now' },
    });
    expect(res.status).toBe(404);
  });
});

describe('smaller hardening', () => {
  it('stops honouring a visitor token left unused for a month', async () => {
    const { visitorToken } = await lead();
    await h.update(
      'identity',
      { channel: 'visitor' },
      { lastUsedAt: ago(31 * DAY) }
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
    await h.update('conversation', { id }, { companyId: moved.id });
    expect(await h.support.store.setSharing(id, company?.id ?? '', true)).toBe(
      false
    );
    expect(
      (await h.find('conversation', { id })).map(c => ({
        sharedWithCompany: c.sharedWithCompany,
      }))
    ).toEqual([{ sharedWithCompany: false }]);
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
    const [bob] = await h.find('contact', { email: 'bob@example.test' });
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

    expect(await h.count('message', { body: 'from bob' })).toBe(0);
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

  it('rewrites the agent’s own text in the mode asked, into the customer’s language when translating', async () => {
    const asked: { system: string; prompt: string }[] = [];
    const ai = createHarness({
      ai: {
        async generate<T>(input: { system: string; prompt: string }) {
          asked.push(input);
          return {
            reply: 'Lesen Sie [die Anleitung](https://docs.test/a).',
          } as T;
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
      await ai.update('contact', {}, { locale: 'de' });
      const draft = (body: Record<string, unknown>) =>
        ai.call(
          'POST',
          `agent/conversations/${created.data.conversation.id}/draft`,
          {
            user: 'agent',
            body,
          }
        );

      const translated = await draft({
        mode: 'translate',
        text: 'Please read the guide.',
      });
      expect(translated.data.text).toBe(
        'Lesen Sie die Anleitung (https://docs.test/a).'
      );
      expect(asked[0]?.system).toContain(
        'Translate it into Swiss Standard German'
      );
      expect(asked[0]?.prompt).toBe(
        '<reply>\nPlease read the guide.\n</reply>'
      );

      await draft({ mode: 'shorten', text: 'A long reply.' });
      expect(asked[1]?.system).toContain('Make it shorter');
      expect((await draft({ mode: 'shorten' })).status).toBe(400);
      expect((await draft({ mode: 'louder', text: 'Hi' })).status).toBe(400);
      expect(asked).toHaveLength(2);

      // Asking for a draft with no body at all still drafts.
      const bare = await ai.call(
        'POST',
        `agent/conversations/${created.data.conversation.id}/draft`,
        { user: 'agent', headers: { 'content-type': 'application/json' } }
      );
      expect(bare.status).toBe(200);
      expect(asked).toHaveLength(3);
    } finally {
      await ai.close();
    }
  });

  it('refuses a rewrite without an AI adapter', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const created = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: { inbox: 'support', type: 'question', body: 'hi' },
    });
    const res = await h.call(
      'POST',
      `agent/conversations/${created.data.conversation.id}/draft`,
      { user: 'agent', body: { mode: 'formal', text: 'hey' } }
    );
    expect(res.status).toBe(400);
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
