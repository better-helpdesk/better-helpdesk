import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import type { InboundMessage } from '../src';
import { createHarness } from './harness';

const h = createHarness({
  customFields: {
    contact: [
      {
        key: 'tier',
        label: { en: 'Tier', de: 'Stufe' },
        type: 'select',
        options: ['gold', 'silver'],
      },
    ],
  },
});
const orgA = { id: 'org-a', name: 'Org A' };
const orgB = { id: 'org-b', name: 'Org B' };

beforeEach(() => h.reset());
afterAll(() => h.close());

async function rows<T>(query: ReturnType<typeof sql>) {
  return (await h.support.store.db.execute(query)).rows as T[];
}

async function open(user: string, extra: Record<string, unknown> = {}) {
  const res = await h.call('POST', 'widget/conversations', {
    user,
    body: {
      inbox: 'support',
      type: 'question',
      subject: 'How do I export?',
      body: 'Looking for the export button',
      ...extra,
    },
  });
  expect(res.status).toBe(201);
  return res.data.conversation as { id: string; reference: string };
}

describe('agent access', () => {
  it('refuses callers who are not agents', async () => {
    h.addUser('ada');
    expect((await h.call('GET', 'agent/conversations')).status).toBe(401);
    expect(
      (await h.call('GET', 'agent/conversations', { user: 'ada' })).status
    ).toBe(403);
  });

  it('records an agent on first use and lists the inbox longest-waiting first', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const first = await open('ada');
    await h.support.store.db.execute(
      sql`UPDATE helpdesk.conversation SET waiting_since = now() - interval '3 hours' WHERE id = ${first.id}::uuid`
    );
    const second = await open('ada');
    const res = await h.call('GET', 'agent/conversations', { user: 'agent' });
    expect(res.data.conversations.map((c: { id: string }) => c.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(await rows(sql`SELECT 1 FROM helpdesk.agent`)).toHaveLength(1);
  });

  it('stops the waiting clock on a public reply, not on a note', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const conversation = await open('ada');
    const waiting = async () =>
      (
        await rows<{ waiting_since: Date | null }>(
          sql`SELECT waiting_since FROM helpdesk.conversation`
        )
      )[0]?.waiting_since;

    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'note', internal: true },
    });
    expect(await waiting()).not.toBeNull();
    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'reply' },
    });
    expect(await waiting()).toBeNull();
  });

  it('reopens a resolved conversation when the customer writes again', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const conversation = await open('ada');
    await h.call('PATCH', `agent/conversations/${conversation.id}`, {
      user: 'agent',
      body: { status: 'resolved' },
    });
    await h.call('POST', `widget/conversations/${conversation.id}/messages`, {
      user: 'ada',
      body: { body: 'still broken' },
    });
    const [row] = await rows<{ status: string; resolved_at: Date | null }>(
      sql`SELECT status, resolved_at FROM helpdesk.conversation`
    );
    expect(row).toEqual({ status: 'open', resolved_at: null });
  });

  it('refuses an unknown assignee', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const conversation = await open('ada');
    const res = await h.call(
      'PATCH',
      `agent/conversations/${conversation.id}`,
      {
        user: 'agent',
        body: { assigneeId: '00000000-0000-4000-8000-000000000000' },
      }
    );
    expect(res.status).toBe(400);
  });
});

describe('jobs and email', () => {
  it('rejects the jobs endpoint without the secret', async () => {
    expect((await h.call('POST', 'jobs')).status).toBe(401);
    expect(
      (
        await h.call('POST', 'jobs', {
          headers: { authorization: 'Bearer nope' },
        })
      ).status
    ).toBe(401);
    expect(
      (
        await h.call('POST', 'jobs', {
          headers: { authorization: 'Bearer jobs-secret' },
        })
      ).status
    ).toBe(200);
  });

  it('claims each job once under concurrent runners', async () => {
    for (let i = 0; i < 20; i++) {
      await h.support.store.enqueueJob('ai-triage', {
        conversationId: randomUUID(),
      });
    }
    const [a, b] = await Promise.all([
      h.support.store.claimJobs(15),
      h.support.store.claimJobs(15),
    ]);
    const ids = [...(a ?? []), ...(b ?? [])].map(j => j.id);
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
  });

  it('backs a failing job off and parks it after its last attempt', async () => {
    await h.support.store.enqueueJob('no-such-kind', {});
    for (let i = 0; i < 5; i++) await h.runDueJobs();
    const [job] = await rows<{
      attempts: number;
      run_at: string;
      last_error: string;
    }>(sql`SELECT attempts, run_at::text, last_error FROM helpdesk.job`);
    expect(job?.attempts).toBe(5);
    expect(job?.run_at).toBe('infinity');
    expect(job?.last_error).toContain('no-such-kind');
  });

  it('emails agents about a new conversation', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
    await h.call('GET', 'agent/me', { user: 'agent' });
    const conversation = await open('ada');
    await h.runDueJobs();
    expect(h.emails).toEqual([
      expect.objectContaining({
        kind: 'agent-new',
        to: 'agent@devguard.test',
        reference: conversation.reference,
      }),
    ]);
  });

  it('emails the customer a reply they have not seen, with the threading address', async () => {
    h.addUser('ada', { email: 'ada@example.test' });
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
    const conversation = await open('ada');
    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'Here is how' },
    });
    await h.runDueJobs();
    const replies = h.emails.filter(e => e.kind === 'customer-reply');
    expect(replies).toEqual([
      expect.objectContaining({
        to: 'ada@example.test',
        body: 'Here is how',
        replyTo: `support+${conversation.reference}@devguard.test`,
      }),
    ]);
  });

  it('skips the reply email when the customer already saw it in the widget', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const conversation = await open('ada');
    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'Here is how' },
    });
    await h.call('POST', `widget/conversations/${conversation.id}/seen`, {
      user: 'ada',
      body: {},
    });
    await h.runDueJobs();
    expect(h.emails.filter(e => e.kind === 'customer-reply')).toEqual([]);
  });

  it('reminds agents once about a customer left waiting', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
    await h.call('GET', 'agent/me', { user: 'agent' });
    await open('ada');
    await h.support.store.db.execute(
      sql`UPDATE helpdesk.conversation SET waiting_since = now() - interval '2 hours'`
    );
    await h.runDueJobs();
    await h.runDueJobs();
    expect(h.emails.filter(e => e.kind === 'agent-reminder')).toHaveLength(1);
  });
});

describe('deletion', () => {
  it('hard-deletes an organization and its files, and keeps the same person’s other organization', async () => {
    h.addUser('ada', { orgs: [orgA, orgB] });
    const a = await open('ada', { orgId: orgA.id });
    const b = await open('ada', { orgId: orgB.id });
    const upload = await h.call(
      'POST',
      `widget/conversations/${a.id}/attachments`,
      {
        user: 'ada',
        body: { filename: 'a.png', contentType: 'image/png', size: 10 },
      }
    );
    const key = upload.data.upload.fields.key as string;
    h.objects.set(key, new Uint8Array([1]));
    await h.call(
      'POST',
      `widget/conversations/${a.id}/attachments/${upload.data.id}/complete`,
      { user: 'ada', body: {} }
    );

    await h.support.deleteCompany(orgA.id);

    expect(h.objects.has(key)).toBe(false);
    const left = await rows<{ id: string }>(
      sql`SELECT id FROM helpdesk.conversation`
    );
    expect(left.map(r => r.id)).toEqual([b.id]);
    expect(
      await rows(
        sql`SELECT 1 FROM helpdesk.company WHERE external_org_id = ${orgA.id}`
      )
    ).toHaveLength(0);
    expect(await rows(sql`SELECT 1 FROM helpdesk.attachment`)).toHaveLength(0);
  });

  it('deletes the contacts that belonged only to the organization', async () => {
    h.addUser('ada', { orgs: [orgA] });
    await open('ada', { orgId: orgA.id });
    await h.support.deleteCompany(orgA.id);
    expect(await rows(sql`SELECT 1 FROM helpdesk.contact`)).toHaveLength(0);
    expect(await rows(sql`SELECT 1 FROM helpdesk.identity`)).toHaveLength(0);
  });

  it('deletes resolved conversations past the retention period', async () => {
    const retained = createHarness({ retentionDays: 30 });
    try {
      h.addUser('ada');
      const conversation = await open('ada');
      await retained.support.store.db.execute(
        sql`UPDATE helpdesk.conversation SET status = 'resolved', resolved_at = now() - interval '31 days' WHERE id = ${conversation.id}::uuid`
      );
      await retained.support.runJobs();
      expect(await rows(sql`SELECT 1 FROM helpdesk.conversation`)).toHaveLength(
        0
      );
    } finally {
      await retained.close();
    }
  });
});

describe('inbound email', () => {
  const mail = (overrides: Partial<InboundMessage> = {}): InboundMessage => ({
    messageId: '<m1@mail.test>',
    from: { address: 'Carol@Example.test', name: 'Carol' },
    to: ['support@devguard.test'],
    subject: 'Login trouble',
    text: 'I cannot log in',
    references: [],
    verified: true,
    automated: false,
    attachments: [],
    ...overrides,
  });

  it('creates one conversation per message even when polled twice', async () => {
    await h.support.handleInbound(mail());
    await h.support.handleInbound(mail());
    expect(await rows(sql`SELECT 1 FROM helpdesk.conversation`)).toHaveLength(
      1
    );
    expect(await rows(sql`SELECT 1 FROM helpdesk.message`)).toHaveLength(1);
  });

  it('threads a reply to the plus address into its conversation', async () => {
    h.addUser('carol', { email: 'carol@example.test' });
    const conversation = await open('carol');
    await h.support.handleInbound(
      mail({
        messageId: '<reply@mail.test>',
        to: [`support+${conversation.reference}@devguard.test`],
        text: 'Thanks',
      })
    );
    const messages = await rows<{ conversation_id: string }>(
      sql`SELECT conversation_id FROM helpdesk.message WHERE body = 'Thanks'`
    );
    expect(messages).toEqual([{ conversation_id: conversation.id }]);
  });

  it('does not let another sender post into a thread by its address', async () => {
    h.addUser('carol', { email: 'carol@example.test' });
    const conversation = await open('carol');
    await h.support.handleInbound(
      mail({
        messageId: '<x@mail.test>',
        from: { address: 'mallory@evil.test' },
        to: [`support+${conversation.reference}@devguard.test`],
      })
    );
    const [row] = await rows<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM helpdesk.message WHERE conversation_id = ${conversation.id}::uuid`
    );
    expect(row?.count).toBe(1);
    expect(await rows(sql`SELECT 1 FROM helpdesk.conversation`)).toHaveLength(
      2
    );
  });

  it('verifies the typed address of a lead who replies by email', async () => {
    const created = await h.call('POST', 'widget/conversations', {
      body: {
        inbox: 'sales',
        type: 'lead',
        body: 'Pricing for 50 seats?',
        email: 'Carol@Example.test',
        name: 'Carol',
      },
    });
    const { reference } = created.data.conversation as { reference: string };

    await h.support.handleInbound(
      mail({
        messageId: '<lead-reply@x>',
        to: [`support+${reference}@devguard.test`],
      })
    );

    expect(
      await rows(
        sql`SELECT verified FROM helpdesk.identity WHERE channel = 'email' ORDER BY verified`
      )
    ).toEqual([{ verified: false }, { verified: true }]);
  });

  it('emails agents when a reply by email reopens a resolved conversation', async () => {
    h.addUser('carol', { email: 'carol@example.test' });
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
    await h.call('GET', 'agent/me', { user: 'agent' });
    const conversation = await open('carol');
    await h.runDueJobs();
    h.emails.length = 0;
    await h.call('PATCH', `agent/conversations/${conversation.id}`, {
      user: 'agent',
      body: { status: 'resolved' },
    });

    await h.support.handleInbound(
      mail({
        messageId: '<reopen@mail.test>',
        to: [`support+${conversation.reference}@devguard.test`],
        text: 'It is back',
      })
    );
    await h.runDueJobs();

    expect(h.emails).toEqual([
      expect.objectContaining({
        kind: 'agent-new',
        to: 'agent@devguard.test',
        body: 'It is back',
        reopened: true,
      }),
    ]);
  });

  it('attaches a DMARC-passing sender to their verified contact but never an unverified one', async () => {
    h.addUser('carol', { email: 'carol@example.test' });
    await open('carol');
    await h.support.handleInbound(
      mail({ messageId: '<a@x>', verified: false })
    );
    expect(await rows(sql`SELECT 1 FROM helpdesk.contact`)).toHaveLength(2);
    await h.support.handleInbound(mail({ messageId: '<b@x>', verified: true }));
    expect(await rows(sql`SELECT 1 FROM helpdesk.contact`)).toHaveLength(2);
    const [row] = await rows<{ contacts: number }>(sql`
      SELECT count(DISTINCT contact_id)::int AS contacts FROM helpdesk.conversation`);
    expect(row?.contacts).toBe(2);
  });
});

describe('CRM', () => {
  it('validates custom fields against the config', async () => {
    h.addUser('agent', { isAgent: true });
    const created = await h.call('POST', 'agent/contacts', {
      user: 'agent',
      body: { name: 'Dana' },
    });
    const id = created.data.contact.id;
    expect(
      (
        await h.call('PATCH', `agent/contacts/${id}`, {
          user: 'agent',
          body: { custom: { tier: 'bronze' } },
        })
      ).status
    ).toBe(400);
    expect(
      (
        await h.call('PATCH', `agent/contacts/${id}`, {
          user: 'agent',
          body: { custom: { unknown: 'x' } },
        })
      ).status
    ).toBe(400);
    expect(
      (
        await h.call('PATCH', `agent/contacts/${id}`, {
          user: 'agent',
          body: { custom: { tier: 'gold' } },
        })
      ).status
    ).toBe(200);
  });

  it('moves a deal between stages', async () => {
    h.addUser('agent', { isAgent: true });
    const deal = await h.call('POST', 'agent/deals', {
      user: 'agent',
      body: { title: 'Pilot', value: 12000 },
    });
    expect(deal.data.deal.stage).toBe('new');
    await rows(
      sql`UPDATE helpdesk.deal SET stage_changed_at = now() - interval '3 days'`
    );
    await h.call('PATCH', `agent/deals/${deal.data.deal.id}`, {
      user: 'agent',
      body: { stage: 'proposal' },
    });
    const [row] = await rows<{ stage: string; recent: boolean }>(
      sql`SELECT stage, stage_changed_at > now() - interval '1 minute' AS recent FROM helpdesk.deal`
    );
    expect(row).toMatchObject({ stage: 'proposal', recent: true });
    expect(
      (
        await h.call('PATCH', `agent/deals/${deal.data.deal.id}`, {
          user: 'agent',
          body: { stage: 'bogus' },
        })
      ).status
    ).toBe(400);
  });

  it('drops a tracked event for an unknown user without creating a contact', async () => {
    expect(
      await h.support.track({
        externalUserId: 'user-ghost',
        event: 'org_created',
      })
    ).toBe(false);
    expect(await rows(sql`SELECT 1 FROM helpdesk.contact`)).toHaveLength(0);
  });

  it('records a tracked event on a known user’s timeline', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    await open('ada');
    expect(
      await h.support.track({
        externalUserId: 'user-ada',
        event: 'plan_changed',
      })
    ).toBe(true);
    const [contact] = await rows<{ id: string }>(
      sql`SELECT id FROM helpdesk.contact`
    );
    const res = await h.call('GET', `agent/contacts/${contact?.id}`, {
      user: 'agent',
    });
    expect(res.data.timeline.map((t: { kind: string }) => t.kind)).toEqual(
      expect.arrayContaining(['event', 'conversation'])
    );
  });

  it('merges two contacts into one', async () => {
    h.addUser('agent', { isAgent: true });
    const a = await h.call('POST', 'agent/contacts', {
      user: 'agent',
      body: { name: 'A' },
    });
    const b = await h.call('POST', 'agent/contacts', {
      user: 'agent',
      body: { name: 'B' },
    });
    await h.call('POST', `agent/contacts/${a.data.contact.id}/merge`, {
      user: 'agent',
      body: { sourceId: b.data.contact.id },
    });
    expect(await rows(sql`SELECT 1 FROM helpdesk.contact`)).toHaveLength(1);
  });

  it('offers a filed contact its own company rather than one to create', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const { store } = h.support;
    const conversation = await open('ada');
    const contactId = (await store.getConversation(conversation.id))
      ?.contactId as string;
    const company = await store.createCompany({ name: 'Acme' });
    await store.updateContact(contactId, { companyId: company.id });

    const res = await h.call('GET', `agent/conversations/${conversation.id}`, {
      user: 'agent',
    });
    expect(res.data.company).toBeNull();
    expect(res.data.suggestedCompany).toMatchObject({ id: company.id });
  });

  it('stops sharing a conversation that moves to another company', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const { store } = h.support;
    const conversation = await open('ada', { body: 'shared' });
    const first = await store.createCompany({ name: 'First' });
    const second = await store.createCompany({ name: 'Second' });
    await store.updateConversation(conversation.id, {
      companyId: first.id,
      sharedWithCompany: true,
    });
    await h.call('PATCH', `agent/conversations/${conversation.id}`, {
      user: 'agent',
      body: { companyId: second.id },
    });
    expect(await store.getConversation(conversation.id)).toMatchObject({
      companyId: second.id,
      sharedWithCompany: false,
    });
  });

  it('lists urgent and high first when sorted by priority', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const older = await open('ada', { body: 'waiting longest' });
    const urgent = await open('ada', { body: 'on fire' });
    await h.support.store.updateConversation(urgent.id, { priority: 'urgent' });
    const list = async (sort: string) =>
      (
        await h.call('GET', `agent/conversations?sort=${sort}`, {
          user: 'agent',
        })
      ).data.conversations.map((c: { id: string }) => c.id);
    expect(await list('waiting')).toEqual([older.id, urgent.id]);
    expect(await list('priority')).toEqual([urgent.id, older.id]);
  });

  it('keeps a deal when its contact is deleted', async () => {
    h.addUser('agent', { isAgent: true });
    const contact = await h.call('POST', 'agent/contacts', {
      user: 'agent',
      body: { name: 'Leaving' },
    });
    await h.call('POST', 'agent/deals', {
      user: 'agent',
      body: { title: 'Pilot', contactId: contact.data.contact.id },
    });
    await h.call('DELETE', `agent/contacts/${contact.data.contact.id}`, {
      user: 'agent',
    });
    expect(
      await rows(sql`SELECT 1 FROM helpdesk.deal WHERE contact_id IS NULL`)
    ).toHaveLength(1);
  });

  it('deletes a contact with a bodiless DELETE, but not from another origin', async () => {
    h.addUser('agent', { isAgent: true });
    const created = await h.call('POST', 'agent/contacts', {
      user: 'agent',
      body: { name: 'Gone' },
    });
    const path = `agent/contacts/${created.data.contact.id}`;
    const foreign = await h.call('DELETE', path, {
      user: 'agent',
      headers: { origin: 'https://evil.example' },
    });
    expect(foreign.status).toBe(403);
    expect((await h.call('DELETE', path, { user: 'agent' })).status).toBe(200);
    expect(await rows(sql`SELECT 1 FROM helpdesk.contact`)).toHaveLength(0);
  });
});

describe('AI', () => {
  it('stores triage as a suggestion and applies it only on accept', async () => {
    const ai = createHarness({
      ai: {
        async generate<T>({ schema }: { schema: z.ZodType<T> }) {
          const shape = (
            schema as unknown as { shape: Record<string, unknown> }
          ).shape;
          return (
            'duplicates' in shape
              ? { duplicates: [] }
              : {
                  type: 'bug',
                  priority: 'high',
                  title: 'Export fails',
                  summary: 's',
                }
          ) as T;
        },
      },
    });
    try {
      ai.addUser('ada');
      ai.addUser('agent', { isAgent: true });
      const res = await ai.call('POST', 'widget/conversations', {
        user: 'ada',
        body: { inbox: 'support', type: 'question', body: 'export fails' },
      });
      await ai.runDueJobs();
      const id = res.data.conversation.id;
      const before = await ai.call('GET', `agent/conversations/${id}`, {
        user: 'agent',
      });
      expect(before.data.conversation.type).toBe('question');
      expect(before.data.conversation.aiSuggestion).toMatchObject({
        type: 'bug',
        priority: 'high',
      });

      await ai.call('POST', `agent/conversations/${id}/suggestion`, {
        user: 'agent',
        body: { action: 'accept' },
      });
      const after = await ai.call('GET', `agent/conversations/${id}`, {
        user: 'agent',
      });
      expect(after.data.conversation).toMatchObject({
        type: 'bug',
        priority: 'high',
        subject: 'Export fails',
      });
      const mine = await ai.call('GET', `widget/conversations/${id}`, {
        user: 'ada',
      });
      expect(mine.data.conversation.subject).toBe('export fails');
    } finally {
      await ai.close();
    }
  });

  it('keeps an agent’s own title when a suggestion is accepted', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const conversation = await open('ada');
    await h.support.store.updateConversation(conversation.id, {
      title: 'Agent title',
      aiSuggestion: { type: 'bug', title: 'AI title' },
    });

    await h.call('POST', `agent/conversations/${conversation.id}/suggestion`, {
      user: 'agent',
      body: { action: 'accept' },
    });

    expect(
      await h.support.store.getConversation(conversation.id)
    ).toMatchObject({ title: 'Agent title', type: 'bug' });
  });

  it('finds a duplicate candidate by full-text search', async () => {
    h.addUser('ada');
    const first = await open('ada', {
      subject: 'CSV export broken',
      body: 'CSV export throws an error',
    });
    await open('ada', {
      subject: 'Invoice address',
      body: 'Change billing address',
    });
    const third = await open('ada', {
      subject: 'Export to CSV fails',
      body: 'the csv export errors',
    });
    const conversation = await h.support.store.getConversation(third.id);
    if (!conversation) throw new Error('missing');
    const candidates = await h.support.store.findDuplicateCandidates(
      conversation,
      'Export to CSV fails the csv export errors'
    );
    expect(candidates[0]?.id).toBe(first.id);
  });
});

describe('job isolation', () => {
  it('still runs queued jobs when an earlier step fails', async () => {
    const store = h.support.store;
    const claimReminders = store.claimReminders;
    store.claimReminders = async () => {
      throw new Error('reminders down');
    };
    try {
      await store.enqueueJob('ai-triage', { conversationId: randomUUID() });
      const report = await h.support.runJobs();
      expect(report).toMatchObject({ jobs: 1, errors: ['reminders'] });
    } finally {
      store.claimReminders = claimReminders;
    }
  });
});

describe('organization events', () => {
  it('records an organization event on its company', async () => {
    h.addUser('agent', { isAgent: true });
    expect(
      await h.support.track({
        externalOrgId: 'org-z',
        event: 'plan_changed',
        props: { to: 'business' },
      })
    ).toBe(true);
    const list = await h.call('GET', 'agent/companies', { user: 'agent' });
    const company = list.data.companies[0];
    expect(company.externalOrgId).toBe('org-z');
    const detail = await h.call('GET', `agent/companies/${company.id}`, {
      user: 'agent',
    });
    expect(detail.data.timeline).toEqual([
      expect.objectContaining({ kind: 'event', title: 'plan_changed' }),
    ]);
  });
});

describe('inbound threading trust', () => {
  it('opens a new conversation for a forged sender that fails DMARC', async () => {
    h.addUser('carol', { email: 'carol@example.test' });
    const conversation = await open('carol');
    await h.support.handleInbound({
      messageId: '<forged@mail.test>',
      from: { address: 'carol@example.test' },
      to: [`support+${conversation.reference}@devguard.test`],
      subject: 'Re',
      text: 'forged',
      references: [],
      verified: false,
      automated: false,
      attachments: [],
    });
    const [row] = await rows<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM helpdesk.message WHERE conversation_id = ${conversation.id}::uuid`
    );
    expect(row?.count).toBe(1);
  });
});

describe('jobs route', () => {
  it('accepts the scheduler’s trailing-slash POST without a JSON body', async () => {
    const res = await h.support.handler(
      new Request('https://app.test/api/helpdesk/jobs/', {
        method: 'POST',
        headers: { authorization: 'Bearer jobs-secret' },
      })
    );
    expect(res.status).toBe(200);
  });
});

describe('customer-facing status', () => {
  it('waits on the customer after a public reply and on the team after theirs', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const conversation = await open('ada');
    const status = async () =>
      (
        await rows<{ status: string }>(
          sql`SELECT status FROM helpdesk.conversation`
        )
      )[0]?.status;

    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'note', internal: true },
    });
    expect(await status()).toBe('open');
    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'Does that help?' },
    });
    expect(await status()).toBe('pending');
    await h.call('POST', `widget/conversations/${conversation.id}/messages`, {
      user: 'ada',
      body: { body: 'Not quite' },
    });
    expect(await status()).toBe('open');
  });

  it('leaves a read thread read when the team adds a note', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const conversation = await open('ada');
    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'Does that help?' },
    });
    await h.call('POST', `widget/conversations/${conversation.id}/seen`, {
      user: 'ada',
      body: {},
    });

    await h.call('POST', `agent/conversations/${conversation.id}/messages`, {
      user: 'agent',
      body: { body: 'note', internal: true },
    });

    const session = await h.call('GET', 'widget/session', { user: 'ada' });
    expect(session.data.conversations).toEqual([
      expect.objectContaining({ id: conversation.id, unread: false }),
    ]);
  });

  it('sends a receipt to someone who wrote into a receipt inbox', async () => {
    const receipts = createHarness({
      inboxes: { sales: { public: true, receipt: true } },
    });
    try {
      await receipts.call('POST', 'widget/conversations', {
        body: {
          inbox: 'sales',
          type: 'lead',
          body: 'Pricing?',
          email: 'p@x.test',
        },
      });
      await receipts.runDueJobs();
      expect(receipts.emails).toEqual([
        expect.objectContaining({ kind: 'customer-receipt', to: 'p@x.test' }),
      ]);
      // The address is unproven, so nothing the sender typed goes back out.
      expect(JSON.stringify(receipts.emails)).not.toContain('Pricing?');
    } finally {
      await receipts.close();
    }
  });
});

describe('contact list', () => {
  it('counts each contact’s conversations', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    await open('ada');
    await open('ada');
    const res = await h.call('GET', 'agent/contacts', { user: 'agent' });
    expect(res.data.contacts[0]).toMatchObject({ conversationCount: 2 });
  });

  it('marks the team among contacts and keeps captured context off company pages', async () => {
    h.addUser('agent', { isAgent: true, email: 'angelo@devguard.test' });
    h.addUser('ada');
    await h.call('GET', 'agent/me', { user: 'agent' });
    await h.call('POST', 'agent/contacts', {
      user: 'agent',
      body: { name: 'Angelo', email: 'angelo@devguard.test' },
    });
    await open('ada');
    const list = await h.call('GET', 'agent/contacts', { user: 'agent' });
    const team = list.data.contacts.filter(
      (c: { isTeam: boolean }) => c.isTeam
    );
    expect(team.map((c: { email: string }) => c.email)).toEqual([
      'angelo@devguard.test',
    ]);

    const company = await h.support.store.createCompany({ name: 'Acme' });
    const [ada] = await rows<{ id: string }>(
      sql`SELECT id FROM helpdesk.contact WHERE email = 'ada@example.test'`
    );
    await h.support.store.updateContact(ada?.id as string, {
      companyId: company.id,
    });
    const detail = await h.call('GET', `agent/companies/${company.id}`, {
      user: 'agent',
    });
    expect(detail.data.contacts[0]).toHaveProperty('source');
    expect(detail.data.contacts[0]).not.toHaveProperty('firstContext');
  });

  it('answers a reference search longer than any number', async () => {
    h.addUser('agent', { isAgent: true });
    const res = await h.call('GET', 'agent/conversations?q=DG-99999999999', {
      user: 'agent',
    });
    expect(res.status).toBe(200);
  });
});

describe('reopening', () => {
  it('counts a reopened conversation as waiting when the customer spoke last', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const conversation = await open('ada');
    const waiting = async () =>
      (await h.call('GET', 'agent/unread', { user: 'agent' })).data.waiting;
    expect(await waiting()).toBe(1);
    const path = `agent/conversations/${conversation.id}`;
    await h.call('PATCH', path, {
      user: 'agent',
      body: { status: 'resolved' },
    });
    expect(await waiting()).toBe(0);
    await h.call('PATCH', path, { user: 'agent', body: { status: 'open' } });
    expect(await waiting()).toBe(1);
  });

  it('emails agents once when a customer reopens a resolved conversation', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
    await h.call('GET', 'agent/me', { user: 'agent' });
    const conversation = await open('ada');
    await h.runDueJobs();
    h.emails.length = 0;
    await h.call('PATCH', `agent/conversations/${conversation.id}`, {
      user: 'agent',
      body: { status: 'resolved' },
    });
    const write = (body: string) =>
      h.call('POST', `widget/conversations/${conversation.id}/messages`, {
        user: 'ada',
        body: { body },
      });

    await write('still broken');
    await write('and now it crashes');
    await h.runDueJobs();

    expect(h.emails).toEqual([
      expect.objectContaining({
        kind: 'agent-new',
        to: 'agent@devguard.test',
        reference: conversation.reference,
        body: 'still broken',
        reopened: true,
      }),
    ]);
  });
});

describe('agents in the widget', () => {
  it('tells an agent what waits in the inbox, and a customer nothing', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    await open('ada');
    const session = (user: string) =>
      h.call('GET', 'widget/session?inbox=support', { user });
    expect((await session('agent')).data.agent).toMatchObject({
      waiting: 1,
      url: expect.stringMatching(/\/conversations\/$/),
    });
    expect((await session('ada')).data.agent).toBeNull();
  });
});

describe('settings', () => {
  it('gives the widget the confirmation text set in the admin', async () => {
    h.addUser('agent', { isAgent: true });
    h.addUser('ada');
    const session = (locale: string) =>
      h.call('GET', `widget/session?inbox=support&locale=${locale}`, {
        user: 'ada',
      });
    expect((await session('de')).data.confirmation).toBeNull();

    await h.call('PUT', 'agent/settings', {
      user: 'agent',
      body: { confirmation: { de: 'Danke! Antwort an {email}.', en: '' } },
    });
    expect((await session('de')).data.confirmation).toBe(
      'Danke! Antwort an {email}.'
    );
    expect((await session('en')).data.confirmation).toBeNull();
    const saved = await h.call('GET', 'agent/settings', { user: 'agent' });
    expect(saved.data.confirmation.de).toBe('Danke! Antwort an {email}.');
  });
});

describe('away', () => {
  it('promises a return date while everyone who answers is away', async () => {
    h.addUser('agent', { isAgent: true });
    await h.call('GET', 'agent/me', { user: 'agent' });
    const session = () =>
      h.call('GET', 'widget/session?inbox=support', { user: 'ada' });
    h.addUser('ada');
    expect((await session()).data.awayUntil).toBeNull();

    const until = new Date(Date.now() + 3 * 86_400_000).toISOString();
    await h.call('PATCH', 'agent/me', {
      user: 'agent',
      body: { awayUntil: until },
    });
    expect((await session()).data.awayUntil).toBe(until);

    await h.call('PATCH', 'agent/me', {
      user: 'agent',
      body: { awayUntil: null },
    });
    expect((await session()).data.awayUntil).toBeNull();
  });
});

describe('tags', () => {
  it('stores tags lower-cased once each and filters the inbox by one', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const billing = await open('ada');
    await open('ada');
    const res = await h.call('PATCH', `agent/conversations/${billing.id}`, {
      user: 'agent',
      body: { tags: [' Billing', 'billing', 'Bug-1234'] },
    });
    expect(res.status).toBe(200);
    expect(
      await rows(
        sql`SELECT tags FROM helpdesk.conversation WHERE id = ${billing.id}::uuid`
      )
    ).toEqual([{ tags: ['billing', 'bug-1234'] }]);

    const list = async (query: string) =>
      (
        await h.call('GET', `agent/conversations?${query}`, {
          user: 'agent',
        })
      ).data.conversations.map((c: { id: string; tags: string[] }) => [
        c.id,
        c.tags,
      ]);
    expect(await list('tag=BILLING')).toEqual([
      [billing.id, ['billing', 'bug-1234']],
    ]);
    expect(await list('tag=refunds')).toEqual([]);
    expect(await list('')).toHaveLength(2);
  });

  it('refuses a tag longer than fifty characters', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const { id } = await open('ada');
    const res = await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { tags: ['x'.repeat(51)] },
    });
    expect(res.status).toBe(400);
  });

  it('suggests the most-used tags first', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    for (const tags of [['billing', 'vip'], ['billing'], ['onboarding']]) {
      const { id } = await open('ada');
      await h.call('PATCH', `agent/conversations/${id}`, {
        user: 'agent',
        body: { tags },
      });
    }
    const res = await h.call('GET', 'agent/tags', { user: 'agent' });
    expect(res.data.tags).toEqual(['billing', 'onboarding', 'vip']);
  });
});

describe('snooze', () => {
  const later = () => new Date(Date.now() + 86_400_000).toISOString();
  const state = async () =>
    (
      await rows<{ status: string; snoozed_until: Date | null }>(
        sql`SELECT status, snoozed_until FROM helpdesk.conversation`
      )
    )[0];
  const snooze = async (id: string, snoozedUntil: string | null) =>
    h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { snoozedUntil },
    });

  beforeEach(() => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
  });

  it('parks a conversation as pending until the time, lists it as snoozed and wakes it in runJobs', async () => {
    const conversation = await open('ada');
    const until = later();
    expect((await snooze(conversation.id, until)).status).toBe(200);
    expect(
      await rows(
        sql`SELECT status FROM helpdesk.conversation WHERE snoozed_until = ${until}::timestamptz`
      )
    ).toEqual([{ status: 'pending' }]);
    const list = await h.call('GET', 'agent/conversations?status=snoozed', {
      user: 'agent',
    });
    expect(list.data.conversations.map((c: { id: string }) => c.id)).toEqual([
      conversation.id,
    ]);
    expect(
      (
        await h.call('GET', 'agent/conversations?status=open', {
          user: 'agent',
        })
      ).data.conversations
    ).toEqual([]);

    await h.support.runJobs();
    expect((await state())?.status).toBe('pending');

    await h.support.store.db.execute(
      sql`UPDATE helpdesk.conversation SET snoozed_until = now() - interval '1 minute'`
    );
    const report = await h.support.runJobs();
    expect(report.woken).toBe(1);
    expect(await state()).toEqual({ status: 'open', snoozed_until: null });
  });

  it('never reopens a resolved conversation with a stale snooze', async () => {
    const conversation = await open('ada');
    await snooze(conversation.id, later());
    await h.call('PATCH', `agent/conversations/${conversation.id}`, {
      user: 'agent',
      body: { status: 'resolved' },
    });
    expect(await state()).toEqual({ status: 'resolved', snoozed_until: null });

    await h.support.store.db.execute(
      sql`UPDATE helpdesk.conversation SET snoozed_until = now() - interval '1 minute'`
    );
    await h.support.runJobs();
    expect(await state()).toEqual({ status: 'resolved', snoozed_until: null });
  });

  it('wakes on a customer reply', async () => {
    const conversation = await open('ada');
    await snooze(conversation.id, later());
    await h.call('POST', `widget/conversations/${conversation.id}/messages`, {
      user: 'ada',
      body: { body: 'upgrade done early' },
    });
    expect(await state()).toEqual({ status: 'open', snoozed_until: null });
  });

  it('holds back the waiting reminder while snoozed', async () => {
    await h.call('GET', 'agent/me', { user: 'agent' });
    const conversation = await open('ada');
    await snooze(conversation.id, later());
    await h.support.store.db.execute(
      sql`UPDATE helpdesk.conversation SET waiting_since = now() - interval '2 hours'`
    );
    await h.runDueJobs();
    expect(h.emails.filter(e => e.kind === 'agent-reminder')).toEqual([]);
  });

  it('clears the snooze when an agent unsnoozes or reopens, and refuses a time without an offset', async () => {
    const conversation = await open('ada');
    await snooze(conversation.id, later());
    expect((await snooze(conversation.id, null)).status).toBe(200);
    expect(await state()).toEqual({ status: 'pending', snoozed_until: null });

    await snooze(conversation.id, later());
    await h.call('PATCH', `agent/conversations/${conversation.id}`, {
      user: 'agent',
      body: { status: 'open' },
    });
    expect(await state()).toEqual({ status: 'open', snoozed_until: null });

    expect((await snooze(conversation.id, '2026-10-06T09:00')).status).toBe(
      400
    );
    expect(await state()).toEqual({ status: 'open', snoozed_until: null });
  });

  it('refuses a time in the past and a snooze that contradicts the status', async () => {
    const conversation = await open('ada');
    const past = new Date(Date.now() - 60_000).toISOString();
    expect((await snooze(conversation.id, past)).status).toBe(400);
    const res = await h.call(
      'PATCH',
      `agent/conversations/${conversation.id}`,
      {
        user: 'agent',
        body: { status: 'resolved', snoozedUntil: later() },
      }
    );
    expect(res.status).toBe(400);
    expect(await state()).toEqual({ status: 'open', snoozed_until: null });
  });

  it('snoozes a resolved conversation back into the pending queue', async () => {
    const conversation = await open('ada');
    await h.call('PATCH', `agent/conversations/${conversation.id}`, {
      user: 'agent',
      body: { status: 'resolved' },
    });
    await snooze(conversation.id, later());
    const [row] = await rows<{ status: string; resolved_at: Date | null }>(
      sql`SELECT status, resolved_at FROM helpdesk.conversation`
    );
    expect(row).toEqual({ status: 'pending', resolved_at: null });
  });

  it('leaves a snoozed conversation out of the waiting count', async () => {
    const conversation = await open('ada');
    const waiting = async () =>
      (await h.call('GET', 'agent/unread', { user: 'agent' })).data.waiting;
    expect(await waiting()).toBe(1);
    await snooze(conversation.id, later());
    expect(await waiting()).toBe(0);
  });
});
