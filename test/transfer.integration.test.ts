import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { exportConversations, importConversations } from '../src';
import { createHarness } from './harness';

const h = createHarness();

beforeEach(() => h.reset());
afterAll(() => h.close());

async function collect() {
  const lines: string[] = [];
  for await (const c of exportConversations(h.support.store, {
    prefix: 'DG',
  })) {
    lines.push(JSON.stringify(c));
  }
  return lines;
}

describe('export and import', () => {
  it('writes every conversation with its people and messages, and reads them back as new conversations', async () => {
    h.addUser('ada', {
      email: 'ada@example.test',
      orgs: [{ id: 'org-a', name: 'Acme' }],
    });
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
    const res = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: {
        inbox: 'support',
        type: 'bug',
        subject: 'Export broken',
        body: 'The CSV export fails',
        orgId: 'org-a',
      },
    });
    const id: string = res.data.conversation.id;
    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'agent',
      body: { body: 'Checking', internal: true },
    });
    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'agent',
      body: { body: 'Fixed now' },
    });
    await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { status: 'resolved', tags: ['billing'] },
    });

    const lines = await collect();
    expect(lines).toHaveLength(1);
    const exported = JSON.parse(lines[0] as string);
    expect(exported).toMatchObject({
      reference: res.data.conversation.reference,
      inbox: 'support',
      type: 'bug',
      status: 'resolved',
      subject: 'Export broken',
      tags: ['billing'],
      contact: { email: 'ada@example.test' },
      company: { name: 'Acme' },
      messages: [
        {
          author: 'contact',
          email: 'ada@example.test',
          body: 'The CSV export fails',
        },
        { author: 'agent', email: 'agent@devguard.test', internal: true },
        { author: 'agent', body: 'Fixed now', internal: false },
      ],
      events: expect.arrayContaining([
        expect.objectContaining({ kind: 'status' }),
      ]),
    });

    const report = await importConversations(h.support.store, lines, {
      source: 'Old helpdesk',
    });
    expect(report).toMatchObject({ created: 1, skipped: 0 });
    const rows = await h.find(
      'conversation',
      {},
      { orderBy: { number: 'asc' } }
    );
    expect(rows).toHaveLength(2);
    const copy = rows[1];
    expect(copy).toMatchObject({
      status: 'resolved',
      subject: 'Export broken',
      contactId: rows[0]?.contactId,
      companyId: rows[0]?.companyId,
      createdAt: rows[0]?.createdAt,
      context: {
        imported: { reference: exported.reference, source: 'Old helpdesk' },
      },
      respondBy: null,
    });
    expect(copy?.number).toBe((rows[0]?.number as number) + 1);
    const messages = await h.find(
      'message',
      { conversationId: copy?.id },
      { orderBy: { createdAt: 'asc' } }
    );
    const agent = await h.findOne('agent', { name: 'agent' });
    expect(messages.map(m => [m.authorType, m.internal, m.agentId])).toEqual([
      ['contact', false, null],
      ['agent', true, agent?.id],
      ['agent', false, agent?.id],
    ]);
    expect(await h.count('contact')).toBe(1);
  });

  it('skips a line it cannot read and says which', async () => {
    const report = await importConversations(h.support.store, [
      'not json',
      JSON.stringify({
        inbox: 'support',
        type: 'bug',
        createdAt: 'yesterday',
        contact: {},
        messages: [],
      }),
      JSON.stringify({
        inbox: 'support',
        type: 'question',
        createdAt: '2026-01-05T10:00:00Z',
        contact: { email: 'x@example.test' },
        messages: [
          { author: 'contact', body: 'hi', createdAt: '2026-01-05T10:00:00Z' },
        ],
      }),
    ]);
    expect(report).toMatchObject({ created: 1, skipped: 2 });
    expect(report.notes).toEqual([
      'line 1: not JSON, skipped',
      expect.stringContaining('line 2:'),
    ]);
    expect(await h.findOne('conversation')).toMatchObject({
      channel: 'api',
      status: 'open',
      waitingSince: new Date('2026-01-05T10:00:00Z'),
    });
  });
});
