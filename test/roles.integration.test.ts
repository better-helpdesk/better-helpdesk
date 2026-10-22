import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

const h = createHarness();

beforeEach(() => h.reset());
afterAll(() => h.close());

async function open(user: string) {
  const res = await h.call('POST', 'widget/conversations', {
    user,
    body: { inbox: 'support', type: 'question', body: 'Where is the export?' },
  });
  expect(res.status).toBe(201);
  return res.data.conversation as { id: string; reference: string };
}

describe('roles', () => {
  it('lets a viewer read and refuses every change but their own away time', async () => {
    h.addUser('ada');
    h.addUser('eve', { isAgent: true, role: 'viewer' });
    const { id } = await open('ada');
    expect(
      (await h.call('GET', 'agent/conversations', { user: 'eve' })).status
    ).toBe(200);
    expect(
      (await h.call('GET', `agent/conversations/${id}`, { user: 'eve' })).status
    ).toBe(200);
    const me = await h.call('GET', 'agent/me', { user: 'eve' });
    expect(me.data.agent.role).toBe('viewer');
    expect(
      (
        await h.call('PATCH', `agent/conversations/${id}`, {
          user: 'eve',
          body: { status: 'resolved' },
        })
      ).status
    ).toBe(403);
    expect(
      (
        await h.call('POST', `agent/conversations/${id}/messages`, {
          user: 'eve',
          body: { body: 'hi' },
        })
      ).status
    ).toBe(403);
    expect(
      (
        await h.call('PATCH', 'agent/me', {
          user: 'eve',
          body: { awayUntil: null },
        })
      ).status
    ).toBe(200);
    expect(await h.findOne('conversation', { id })).toMatchObject({
      status: 'open',
    });
  });

  it('keeps settings and the team open to every agent until a supervisor exists', async () => {
    h.addUser('agent', { isAgent: true });
    h.addUser('boss', { isAgent: true, role: 'supervisor' });
    const save = (user: string) =>
      h.call('PUT', 'agent/settings', {
        user,
        body: { confirmation: { en: 'Thanks' } },
      });
    expect((await save('agent')).status).toBe(200);
    await h.call('GET', 'agent/me', { user: 'boss' });
    expect((await save('agent')).status).toBe(403);
    expect((await save('boss')).status).toBe(200);
    const agent = await h.findOne('agent', { name: 'agent' });
    expect(
      (await h.call('DELETE', `agent/agents/${agent?.id}`, { user: 'agent' }))
        .status
    ).toBe(403);
    expect(await h.findOne('agent', { name: 'boss' })).toMatchObject({
      role: 'supervisor',
    });
  });
});

describe('the audit log', () => {
  it('records every change an agent makes, with the fields and the target, never the values', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true });
    const { id } = await open('ada');
    await h.call('GET', 'agent/conversations', { user: 'agent' });
    await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { status: 'pending', tags: ['secret-customer'] },
    });
    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'agent',
      body: { body: 'Confidential reply', internal: false },
    });
    const refused = await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { priority: 'nope' },
    });
    expect(refused.status).toBe(400);
    const rows = await h.find(
      'audit_log',
      {},
      { orderBy: { createdAt: 'asc' } }
    );
    const agent = await h.findOne('agent', { name: 'agent' });
    expect(rows).toMatchObject([
      {
        agentId: agent?.id,
        action: 'PATCH conversations/:id',
        target: id,
        data: { fields: ['status', 'tags'] },
      },
      {
        agentId: agent?.id,
        action: 'POST conversations/:id/messages',
        target: id,
        data: { fields: ['body', 'internal'] },
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain('Confidential');
    const listed = await h.call('GET', 'agent/audit', { user: 'agent' });
    expect(listed.data.entries).toMatchObject([
      { action: 'POST conversations/:id/messages', agentName: 'agent' },
      { action: 'PATCH conversations/:id' },
    ]);
  });

  it('is a supervisor’s once there is one', async () => {
    h.addUser('agent', { isAgent: true });
    h.addUser('boss', { isAgent: true, role: 'supervisor' });
    await h.call('GET', 'agent/me', { user: 'boss' });
    expect((await h.call('GET', 'agent/audit', { user: 'agent' })).status).toBe(
      403
    );
    expect((await h.call('GET', 'agent/audit', { user: 'boss' })).status).toBe(
      200
    );
  });
});

describe('health', () => {
  it('answers while the database does', async () => {
    const res = await h.call('GET', 'health');
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
  });
});
