import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { BusinessHours, HelpdeskEvent } from '../src';
import { createHarness } from './harness';

const office: BusinessHours = {
  timeZone: 'UTC',
  weekly: Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri'].map(d => [d, [['08:00', '17:00']]])
  ),
};

const events: HelpdeskEvent[] = [];
const h = createHarness({
  tiers: ['gold', 'platinum'],
  priorityLabels: {
    urgent: { en: 'P1' },
    high: { en: 'P2' },
    normal: { en: 'P3' },
  },
  inboxes: {
    support: {
      public: true,
      receipt: true,
      priorities: {
        options: {
          urgent: { en: 'P1: the platform is down' },
          high: { en: 'P2: a key function is unavailable' },
        },
        tiers: ['gold', 'platinum'],
      },
    },
    office: {
      hours: office,
      priorities: { options: { urgent: { en: 'P1' } } },
    },
  },
  sla: {
    tiers: {
      gold: { targets: { urgent: { respond: 4, resolve: 24 } } },
      platinum: {
        targets: {
          urgent: { respond: 1, resolve: 8 },
          normal: { respond: 8, resolve: 48 },
        },
      },
    },
    default: { targets: { normal: { respond: 24 } } },
    warnAt: 0.5,
  },
  resolveTier: async ({ orgId, email }) =>
    orgId === 'org-gold' || email?.endsWith('@gold.test') ? 'gold' : null,
  async onEvent(event) {
    events.push(event);
  },
});
const orgGold = { id: 'org-gold', name: 'Gold Org' };

beforeEach(async () => {
  await h.reset();
  events.length = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T10:00:00Z')); // a Tuesday
});
afterEach(() => vi.useRealTimers());
afterAll(() => h.close());

const at = (iso: string) => new Date(iso);
const tick = (iso: string) => vi.setSystemTime(at(iso));
// The app's clock moves a millisecond per call, so times are read to the second.
const sec = (value: unknown) =>
  value instanceof Date
    ? new Date(Math.floor(value.getTime() / 1000) * 1000)
    : value;
const dated = <T extends object>(row: T | null) =>
  row &&
  (Object.fromEntries(Object.entries(row).map(([k, v]) => [k, sec(v)])) as T);
const row = async (id: string) =>
  dated(await h.findOne('conversation', { id }));
const starts = (iso: string) => expect.stringMatching(`^${iso.slice(0, 19)}`);

async function open(
  user: string,
  body: Record<string, unknown> = {},
  inbox = 'support'
) {
  const res = await h.call('POST', 'widget/conversations', {
    user,
    body: {
      inbox,
      type: 'bug',
      subject: 'Deploys fail',
      body: 'Every deploy since this morning fails.',
      ...body,
    },
  });
  expect(res.status).toBe(201);
  return res.data.conversation as { id: string; reference: string };
}

describe('tiers and priorities at intake', () => {
  it('takes the tier from the host and the priority from the customer, and starts the clocks', async () => {
    h.addUser('ada', { orgs: [orgGold] });
    const { id } = await open('ada', { orgId: orgGold.id, priority: 'urgent' });
    expect(await row(id)).toMatchObject({
      tier: 'gold',
      priority: 'urgent',
      channel: 'widget',
      respondBy: at('2026-10-20T14:00:00Z'),
      resolveBy: at('2026-10-21T10:00:00Z'),
      slaDueAt: at('2026-10-20T14:00:00Z'),
      slaPausedAt: null,
    });
    const session = await h.call('GET', 'widget/session?inbox=support', {
      user: 'ada',
    });
    expect(session.data.inbox.priorities).toEqual([
      {
        value: 'high',
        description: { en: 'P2: a key function is unavailable' },
      },
      { value: 'urgent', description: { en: 'P1: the platform is down' } },
    ]);
    expect(session.data.priorityLabels).toEqual({
      urgent: { en: 'P1' },
      high: { en: 'P2' },
      normal: { en: 'P3' },
    });
    expect(session.data.conversations[0].respondBy).toEqual(
      starts('2026-10-20T14:00:00Z')
    );
  });

  it('refuses a priority the inbox does not offer', async () => {
    h.addUser('ada', { orgs: [orgGold] });
    const res = await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: {
        inbox: 'support',
        type: 'bug',
        body: 'x',
        priority: 'low',
        orgId: orgGold.id,
      },
    });
    expect(res.status).toBe(400);
  });

  it('offers the priorities only to the tiers the inbox names, and never to a visitor', async () => {
    h.addUser('ada', { orgs: [orgGold] });
    h.addUser('bob');
    const offered = async (user?: string, org = '') =>
      (
        await h.call('GET', `widget/session?inbox=support&org=${org}`, {
          user,
        })
      ).data.inbox.priorities;
    expect(await offered('ada', orgGold.id)).toHaveLength(2);
    expect(await offered('bob')).toBeNull();
    expect(await offered()).toBeNull();
    const standard = await h.call('POST', 'widget/conversations', {
      user: 'bob',
      body: { inbox: 'support', type: 'bug', body: 'x', priority: 'urgent' },
    });
    expect(standard.status).toBe(400);
    const visitor = await h.call('POST', 'widget/conversations', {
      body: {
        inbox: 'support',
        type: 'bug',
        body: 'x',
        email: 'someone@example.test',
        priority: 'urgent',
      },
    });
    expect(visitor.status).toBe(400);
    // The office inbox names no tiers: any signed-in customer may pick.
    expect(
      (await h.call('GET', 'widget/session?inbox=office', { user: 'bob' })).data
        .inbox.priorities
    ).toHaveLength(1);
  });

  it('leaves the deadlines unset without a target, and a tier alone sets the policy', async () => {
    h.addUser('bob');
    const { id } = await open('bob');
    expect(await row(id)).toMatchObject({
      tier: null,
      respondBy: at('2026-10-21T10:00:00Z'),
      resolveBy: null,
    });
    h.addUser('agent', { isAgent: true });
    const res = await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { tier: 'platinum', priority: 'urgent' },
    });
    expect(res.status).toBe(200);
    expect(await row(id)).toMatchObject({
      tier: 'platinum',
      respondBy: at('2026-10-20T11:00:00Z'),
      resolveBy: at('2026-10-20T18:00:00Z'),
    });
    const timeline = await h.find('conversation_event', { conversationId: id });
    expect(timeline.map(e => e.kind).sort()).toEqual(['priority', 'tier']);
    const bad = await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { tier: 'bronze' },
    });
    expect(bad.status).toBe(400);
  });

  it('tells the customer the response target in the receipt', async () => {
    h.addUser('ada', { orgs: [orgGold] });
    await open('ada', { orgId: orgGold.id, priority: 'urgent' });
    await h.runDueJobs();
    expect(h.emails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'customer-receipt',
          respondBy: starts('2026-10-20T14:00:00Z'),
        }),
      ])
    );
  });

  it('assigns a tier to email that arrives from a known address', async () => {
    await h.support.handleInbound({
      messageId: '<m1@mail.test>',
      from: { address: 'cto@gold.test' },
      to: ['support@devguard.test'],
      subject: 'Outage',
      text: 'Nothing loads.',
      references: [],
      verified: true,
      automated: false,
      attachments: [],
    });
    expect(await h.findOne('conversation')).toMatchObject({
      tier: 'gold',
      channel: 'email',
    });
  });
});

describe('the SLA clock', () => {
  it('pauses on a reply, resumes on the customer, and moves the resolution deadline by the pause', async () => {
    h.addUser('ada', { orgs: [orgGold] });
    h.addUser('agent', { isAgent: true });
    const { id } = await open('ada', { orgId: orgGold.id, priority: 'urgent' });

    tick('2026-10-20T11:00:00Z');
    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'agent',
      body: { body: 'Looking into it.' },
    });
    expect(await row(id)).toMatchObject({
      status: 'pending',
      firstRespondedAt: at('2026-10-20T11:00:00Z'),
      slaPausedAt: at('2026-10-20T11:00:00Z'),
      slaDueAt: null,
    });

    tick('2026-10-20T13:00:00Z');
    await h.call('POST', `widget/conversations/${id}/messages`, {
      user: 'ada',
      body: { body: 'Still failing.' },
    });
    expect(await row(id)).toMatchObject({
      status: 'open',
      slaPausedAt: null,
      slaPausedSeconds: 2 * 3600,
      respondBy: at('2026-10-20T14:00:00Z'),
      resolveBy: at('2026-10-21T12:00:00Z'),
      slaDueAt: at('2026-10-21T12:00:00Z'),
    });
  });

  it('counts open hours for an inbox with business hours', async () => {
    h.addUser('ada', { orgs: [orgGold] });
    tick('2026-10-23T16:00:00Z'); // Friday, an hour before closing
    const { id } = await open(
      'ada',
      { orgId: orgGold.id, priority: 'urgent' },
      'office'
    );
    expect(await row(id)).toMatchObject({
      respondBy: at('2026-10-26T11:00:00Z'),
    });
  });

  it('keeps running through a snooze and stops while resolved', async () => {
    h.addUser('ada', { orgs: [orgGold] });
    h.addUser('agent', { isAgent: true });
    const { id } = await open('ada', { orgId: orgGold.id, priority: 'urgent' });
    await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { snoozedUntil: '2026-10-20T12:00:00Z' },
    });
    expect(await row(id)).toMatchObject({
      status: 'pending',
      slaPausedAt: at('2026-10-20T10:00:00Z'),
    });
    tick('2026-10-20T12:30:00Z');
    await h.runDueJobs();
    expect(await row(id)).toMatchObject({
      status: 'open',
      slaPausedAt: null,
      slaPausedSeconds: 2.5 * 3600,
    });
    await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { status: 'resolved' },
    });
    expect(await row(id)).toMatchObject({
      slaPausedAt: at('2026-10-20T12:30:00Z'),
      slaDueAt: null,
    });
  });
});

describe('SLA notices', () => {
  it('warns at the configured share, then records the breach, once each, to the assignee', async () => {
    h.addUser('ada', { orgs: [orgGold] });
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
    h.addUser('other', { isAgent: true, email: 'other@devguard.test' });
    await h.call('GET', 'agent/me', { user: 'other' });
    await h.call('GET', 'agent/me', { user: 'agent' });
    const { id, reference } = await open('ada', {
      orgId: orgGold.id,
      priority: 'urgent',
    });
    await h.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { assigneeId: (await h.findOne('agent', { name: 'agent' }))?.id },
    });
    const notices = () => h.emails.filter(e => e.kind === 'agent-sla');

    tick('2026-10-20T11:30:00Z');
    await h.runDueJobs();
    expect(notices()).toEqual([]);

    tick('2026-10-20T12:10:00Z'); // past half of the four hours
    const warned = await h.runDueJobs();
    expect(warned.sla).toBe(1);
    await h.runDueJobs();
    expect(notices()).toEqual([
      expect.objectContaining({
        to: 'agent@devguard.test',
        reference,
        target: 'response',
        stage: 'warning',
        due: starts('2026-10-20T14:00:00Z'),
      }),
    ]);
    expect(events.filter(e => e.kind === 'sla.warning')).toMatchObject([
      { target: 'response', due: expect.any(Date) },
    ]);

    tick('2026-10-20T14:30:00Z');
    await h.runDueJobs();
    await h.runDueJobs();
    expect(notices().map(e => e.stage)).toEqual(['warning', 'breach']);
    expect(await h.findOne('conversation', { id })).toMatchObject({
      respondNotice: 'breach',
      resolveNotice: null,
    });
    const rows = await h.find('conversation_event', { conversationId: id });
    expect(rows.map(r => r.kind)).toEqual(
      expect.arrayContaining(['sla.warning', 'sla.breach'])
    );
  });

  it('goes to the supervisors as well, and nothing goes out once answered', async () => {
    h.addUser('ada', { orgs: [orgGold] });
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
    h.addUser('boss', {
      isAgent: true,
      email: 'boss@devguard.test',
      role: 'supervisor',
    });
    await h.call('GET', 'agent/me', { user: 'boss' });
    const { id } = await open('ada', { orgId: orgGold.id, priority: 'urgent' });
    await h.call('POST', `agent/conversations/${id}/messages`, {
      user: 'agent',
      body: { body: 'On it.' },
    });
    await h.call('POST', `widget/conversations/${id}/messages`, {
      user: 'ada',
      body: { body: 'Thanks.' },
    });
    tick('2026-10-20T23:00:00Z'); // past half of the 24 hours to resolve
    await h.runDueJobs();
    await h.runDueJobs();
    const notices = h.emails.filter(e => e.kind === 'agent-sla');
    expect(notices.map(e => [e.to, e.target, e.stage]).sort()).toEqual([
      ['agent@devguard.test', 'resolution', 'warning'],
      ['boss@devguard.test', 'resolution', 'warning'],
    ]);
    // The notice quotes the customer's newest message under the conversation's subject.
    expect(notices.map(e => [e.subject, e.body])).toEqual([
      ['Deploys fail', 'Thanks.'],
      ['Deploys fail', 'Thanks.'],
    ]);
  });
});

describe('the inbox and the overview', () => {
  it('sorts by the nearest deadline and filters by tier and channel', async () => {
    h.addUser('ada', { orgs: [orgGold] });
    h.addUser('bob');
    h.addUser('agent', { isAgent: true });
    const slow = await open('ada', { orgId: orgGold.id, priority: 'high' });
    const none = await open('bob');
    const fast = await open('ada', { orgId: orgGold.id, priority: 'urgent' });
    const byDeadline = await h.call('GET', 'agent/conversations?sort=sla', {
      user: 'agent',
    });
    expect(
      byDeadline.data.conversations.map((c: { id: string }) => c.id)
    ).toEqual([fast.id, none.id, slow.id]);
    const gold = await h.call('GET', 'agent/conversations?tier=gold', {
      user: 'agent',
    });
    expect(gold.data.conversations).toHaveLength(2);
    expect(
      gold.data.conversations.find((c: { id: string }) => c.id === fast.id)
    ).toMatchObject({
      tier: 'gold',
      channel: 'widget',
      slaDueAt: expect.any(String),
    });
    const byEmail = await h.call('GET', 'agent/conversations?channel=email', {
      user: 'agent',
    });
    expect(byEmail.data.conversations).toEqual([]);
  });

  it('reports attainment per tier and lists the missed targets', async () => {
    h.addUser('ada', { orgs: [orgGold] });
    h.addUser('agent', { isAgent: true });
    const met = await open('ada', { orgId: orgGold.id, priority: 'urgent' });
    const missed = await open('ada', { orgId: orgGold.id, priority: 'urgent' });
    tick('2026-10-20T11:00:00Z');
    await h.call('POST', `agent/conversations/${met.id}/messages`, {
      user: 'agent',
      body: { body: 'Fixed.' },
    });
    tick('2026-10-20T15:00:00Z');
    await h.call('POST', `agent/conversations/${missed.id}/messages`, {
      user: 'agent',
      body: { body: 'Sorry for the wait.' },
    });
    const res = await h.call('GET', 'agent/overview?days=7', { user: 'agent' });
    expect(res.data.sla).toBe(true);
    expect(res.data.total.response).toEqual({ met: 1, breached: 1 });
    expect(res.data.tiers).toMatchObject([
      { tier: 'gold', response: { met: 1, breached: 1 } },
    ]);
    expect(res.data.breaches).toMatchObject([
      {
        reference: missed.reference,
        target: 'response',
        tier: 'gold',
        priority: 'urgent',
        late: expect.closeTo(1, 2),
      },
    ]);
  });
});

describe('the next-reply target', () => {
  const r = createHarness({
    inboxes: { support: {} },
    sla: { default: { targets: { normal: { respond: 4, reply: 2 } } } },
  });
  beforeEach(async () => {
    await r.reset();
    vi.useFakeTimers({
      now: new Date('2026-11-02T08:00:00Z'),
      toFake: ['Date'],
    });
  });
  afterEach(() => vi.useRealTimers());
  afterAll(() => r.close());

  const later = (minutes: number) =>
    vi.setSystemTime(Date.now() + minutes * 60_000);
  const row = async (id: string) => {
    const c = await r.findOne('conversation', { id });
    const second = (d: Date | null | undefined) =>
      d ? new Date(Math.round(d.getTime() / 1000) * 1000).toISOString() : null;
    return { replyBy: second(c?.replyBy), slaDueAt: second(c?.slaDueAt) };
  };

  it('runs from each later customer message until an agent answers it', async () => {
    r.addUser('ada');
    r.addUser('agent', { isAgent: true });
    const id = (
      await r.call('POST', 'widget/conversations', {
        user: 'ada',
        body: { inbox: 'support', type: 'question', body: 'Export?' },
      })
    ).data.conversation.id;
    const customer = (body: string) =>
      r.call('POST', `widget/conversations/${id}/messages`, {
        user: 'ada',
        body: { body },
      });
    const agent = (body: string, internal = false) =>
      r.call('POST', `agent/conversations/${id}/messages`, {
        user: 'agent',
        body: { body, internal },
      });
    // The first message waits on the response target, not this one.
    expect((await row(id)).replyBy).toBeNull();

    later(30);
    await agent('Which export?');
    later(30); // 09:00
    await customer('The CSV one.');
    expect(await row(id)).toEqual({
      replyBy: '2026-11-02T11:00:00.000Z',
      slaDueAt: '2026-11-02T11:00:00.000Z',
    });
    expect(
      (await r.call('GET', 'widget/session?inbox=support', { user: 'ada' }))
        .data.conversations[0].respondBy
    ).toMatch(/^2026-11-02T11:00:00/);

    later(30); // 09:30: a second message keeps the first one's deadline.
    await customer('It is empty.');
    await agent('Checking with billing.', true);
    expect((await row(id)).replyBy).toBe('2026-11-02T11:00:00.000Z');

    later(70); // 10:40, past 80% of the two hours at 10:36.
    await r.runDueJobs();
    expect(
      (await r.find('conversation_event', { conversationId: id }))
        .filter(e => String(e.kind).startsWith('sla.'))
        .map(e => [e.kind, (e.data as { target: string }).target])
    ).toEqual([['sla.warning', 'reply']]);

    await agent('Fixed, try again.');
    expect(await row(id)).toEqual({ replyBy: null, slaDueAt: null });

    later(10);
    await customer('Thanks, one more thing.');
    expect((await row(id)).replyBy).not.toBeNull();
    await r.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { status: 'pending' },
    });
    expect((await row(id)).replyBy).toBeNull();
  });
});

describe('a plan change', () => {
  const plans = new Map<string, string>();
  let failing = false;
  const t = createHarness({
    tiers: ['gold'],
    inboxes: { support: {} },
    sla: {
      tiers: { gold: { targets: { normal: { respond: 1 } } } },
      default: { targets: { normal: { respond: 24 } } },
    },
    resolveTier: async ({ orgId }) => {
      if (failing) throw new Error('billing is down');
      return (orgId && plans.get(orgId)) ?? null;
    },
  });
  beforeEach(async () => {
    await t.reset();
    plans.clear();
    failing = false;
  });
  afterAll(() => t.close());

  const open = async () => {
    const res = await t.call('POST', 'widget/conversations', {
      user: 'ada',
      body: {
        inbox: 'support',
        type: 'question',
        body: 'Export?',
        orgId: 'org-1',
      },
    });
    return res.data.conversation.id as string;
  };
  const tierOf = async (id: string) =>
    (await t.findOne('conversation', { id }))?.tier ?? null;

  it('moves open conversations to the tier the host gives now, with fresh deadlines', async () => {
    t.addUser('ada', { orgs: [{ id: 'org-1', name: 'Acme' }] });
    const id = await open();
    const before = await t.findOne('conversation', { id });
    expect(before?.tier).toBeNull();

    plans.set('org-1', 'gold');
    expect(await t.support.refreshTiers({ orgId: 'org-1' })).toBe(1);
    const after = await t.findOne('conversation', { id });
    expect(after?.tier).toBe('gold');
    // From the conversation's start: one hour instead of 24.
    expect(
      (after?.respondBy?.getTime() ?? 0) - (after?.createdAt.getTime() ?? 0)
    ).toBeCloseTo(3_600_000, -3);
    expect(
      (
        await t.find('conversation_event', { conversationId: id, kind: 'tier' })
      ).map(e => [e.agentId, e.data])
    ).toEqual([[null, { from: null, to: 'gold' }]]);
    expect(await t.support.refreshTiers({ orgId: 'org-1' })).toBe(0);
  });

  it('asks again when the customer writes, and leaves a tier an agent chose', async () => {
    t.addUser('ada', { orgs: [{ id: 'org-1', name: 'Acme' }] });
    t.addUser('agent', { isAgent: true });
    const id = await open();
    plans.set('org-1', 'gold');
    await t.call('POST', `widget/conversations/${id}/messages`, {
      user: 'ada',
      body: { body: 'Any news?' },
    });
    expect(await tierOf(id)).toBe('gold');

    await t.call('PATCH', `agent/conversations/${id}`, {
      user: 'agent',
      body: { tier: null },
    });
    plans.set('org-1', 'gold');
    expect(await t.support.refreshTiers({ orgId: 'org-1' })).toBe(0);
    await t.call('POST', `widget/conversations/${id}/messages`, {
      user: 'ada',
      body: { body: 'Still there?' },
    });
    expect(await tierOf(id)).toBeNull();
  });

  it('keeps the tier when the host cannot answer', async () => {
    t.addUser('ada', { orgs: [{ id: 'org-1', name: 'Acme' }] });
    plans.set('org-1', 'gold');
    const id = await open();
    expect(await tierOf(id)).toBe('gold');
    failing = true;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await t.support.refreshTiers({ orgId: 'org-1' })).toBe(0);
    error.mockRestore();
    expect(await tierOf(id)).toBe('gold');
  });
});

describe('service-level notices in the notification bell', () => {
  const b = createHarness({
    inboxes: { support: {} },
    sla: { default: { targets: { normal: { respond: 2 } } }, warnAt: 0.5 },
  });
  beforeEach(async () => {
    await b.reset();
    vi.useFakeTimers({
      now: new Date('2026-11-02T08:00:00Z'),
      toFake: ['Date'],
    });
  });
  afterEach(() => vi.useRealTimers());
  afterAll(() => b.close());

  const later = (minutes: number) =>
    vi.setSystemTime(Date.now() + minutes * 60_000);
  const bell = async (user: string) =>
    (await b.call('GET', 'agent/notifications', { user })).data.notifications
      .filter((n: { kind: string }) => n.kind.startsWith('sla-'))
      .map((n: { kind: string; who: string }) => [n.kind, n.who]);

  it('tells the assignee, everyone while nobody has it, and every supervisor', async () => {
    b.addUser('ada');
    for (const user of ['agent', 'other']) {
      b.addUser(user, { isAgent: true });
      await b.call('GET', 'agent/me', { user });
    }
    b.addUser('boss', { isAgent: true, role: 'supervisor' });
    await b.call('GET', 'agent/me', { user: 'boss' });
    const id = (
      await b.call('POST', 'widget/conversations', {
        user: 'ada',
        body: { inbox: 'support', type: 'question', body: 'Export?' },
      })
    ).data.conversation.id;

    later(70); // past half of the two hours, nobody assigned
    await b.runDueJobs();
    for (const user of ['agent', 'other', 'boss']) {
      expect(await bell(user)).toEqual([['sla-warning', 'response']]);
    }

    const agent = await b.findOne('agent', { name: 'agent' });
    await b.call('PATCH', `agent/conversations/${id}`, {
      user: 'boss',
      body: { assigneeId: agent?.id },
    });
    later(60); // missed
    await b.runDueJobs();
    expect(await bell('agent')).toEqual([
      ['sla-breach', 'response'],
      ['sla-warning', 'response'],
    ]);
    expect(await bell('boss')).toHaveLength(2);
    expect(await bell('other')).toEqual([]);
  });
});
