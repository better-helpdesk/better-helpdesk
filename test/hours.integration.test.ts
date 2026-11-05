import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { BusinessHours } from '../src';
import { createHarness } from './harness';

const office: BusinessHours = {
  timeZone: 'Europe/Zurich',
  weekly: Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri'].map(d => [d, [['08:00', '17:00']]])
  ),
};

const h = createHarness({
  inboxes: {
    support: { reminderAfterHours: 6, hours: office },
    sales: { public: true, receipt: true, hours: office },
    always: { public: true, receipt: true },
  },
});

beforeEach(async () => {
  await h.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => vi.useRealTimers());
afterAll(() => h.close());

const clock = (iso: string) => vi.setSystemTime(new Date(iso));

async function write(inbox: string, user?: string) {
  const res = await h.call('POST', 'widget/conversations', {
    user,
    body: {
      inbox,
      type: 'question',
      body: 'Where is the export?',
      ...(user ? {} : { email: 'visitor@example.test' }),
    },
  });
  expect(res.status).toBe(201);
}

const session = (inbox: string) =>
  h.call('GET', `widget/session?inbox=${inbox}`).then(r => r.data);

describe('business hours', () => {
  it('counts only open hours before reminding, across the March DST change', async () => {
    h.addUser('ada');
    h.addUser('agent', { isAgent: true, email: 'agent@devguard.test' });
    await h.call('GET', 'agent/me', { user: 'agent' });
    await write('support', 'ada');
    // Friday 27 March 17:30 CET, after closing.
    await h.update(
      'conversation',
      {},
      { waitingSince: new Date('2026-03-27T16:30:00Z') }
    );
    const reminders = () => h.emails.filter(e => e.kind === 'agent-reminder');

    clock('2026-03-28T11:00:00Z'); // Saturday noon
    await h.runDueJobs();
    expect(reminders()).toEqual([]);

    clock('2026-03-30T08:00:00Z'); // Monday 10:00 CEST, two open hours
    await h.runDueJobs();
    expect(reminders()).toEqual([]);

    clock('2026-03-30T12:00:00Z'); // Monday 14:00 CEST, six open hours
    await h.runDueJobs();
    expect(reminders()).toEqual([
      expect.objectContaining({ to: 'agent@devguard.test' }),
    ]);
  });

  it('tells the widget and the receipt when a closed inbox opens again', async () => {
    clock('2026-10-24T12:00:00Z'); // Saturday, the October DST change ahead
    expect(await session('sales')).toMatchObject({
      awayUntil: null,
      nextOpening: '2026-10-26T07:00:00.000Z',
    });
    await write('sales');
    await h.runDueJobs();
    expect(h.emails).toEqual([
      expect.objectContaining({
        kind: 'customer-receipt',
        backOn: '2026-10-26T07:00:00.000Z',
      }),
    ]);
    expect(h.emails[0]).not.toHaveProperty('awayUntil', expect.anything());
  });

  it('promises nothing extra while open', async () => {
    clock('2026-10-27T09:00:00Z'); // Tuesday 10:00 CET
    expect((await session('sales')).nextOpening).toBeNull();
    await write('sales');
    await h.runDueJobs();
    const [receipt] = h.emails;
    expect(receipt).toMatchObject({ kind: 'customer-receipt' });
    expect(receipt).not.toHaveProperty('backOn', expect.anything());
  });

  it('opens after the team’s holiday when that ends later', async () => {
    h.addUser('agent', { isAgent: true });
    await h.call('GET', 'agent/me', { user: 'agent' });
    clock('2026-10-24T12:00:00Z');
    // Away through Monday, Zurich time.
    await h.call('PATCH', 'agent/me', {
      user: 'agent',
      body: { awayUntil: '2026-10-26T22:59:59.000Z' },
    });
    expect(await session('sales')).toMatchObject({
      awayUntil: '2026-10-26T22:59:59.000Z',
      nextOpening: '2026-10-27T07:00:00.000Z',
    });
  });

  it('leaves an inbox without hours as it was', async () => {
    clock('2026-10-24T12:00:00Z');
    expect((await session('always')).nextOpening).toBeNull();
    await write('always');
    await h.runDueJobs();
    const [receipt] = h.emails;
    expect(receipt).toMatchObject({ kind: 'customer-receipt' });
    expect(receipt).not.toHaveProperty('backOn', expect.anything());
  });
});

describe('closed days', () => {
  it('skips the days the team closed in the widget’s next opening, and keeps them in the settings', async () => {
    h.addUser('agent', { isAgent: true });
    const put = (closed: unknown) =>
      h.call('PUT', 'agent/settings', { user: 'agent', body: { closed } });
    // Wednesday 23 December 17:30 CET, after closing.
    clock('2026-12-23T16:30:00Z');
    expect((await session('sales')).nextOpening).toBe(
      '2026-12-24T07:00:00.000Z'
    );

    expect(
      (
        await put([
          { date: '2026-12-25', name: 'Christmas Day' },
          { date: '2026-12-24', name: 'Christmas Eve' },
          { date: '2026-12-25' },
        ])
      ).status
    ).toBe(200);
    try {
      expect((await session('sales')).nextOpening).toBe(
        '2026-12-28T07:00:00.000Z'
      );
      expect(
        (await h.call('GET', 'agent/settings', { user: 'agent' })).data.closed
      ).toEqual([
        { date: '2026-12-24', name: 'Christmas Eve' },
        { date: '2026-12-25' },
      ]);
      expect((await put([{ date: '2026-02-30' }])).status).toBe(400);
    } finally {
      await put([]);
    }
    expect((await session('sales')).nextOpening).toBe(
      '2026-12-24T07:00:00.000Z'
    );
  });

  it('carries a response target over a closed day', async () => {
    const sla = createHarness({
      inboxes: { support: { hours: office } },
      sla: { default: { targets: { normal: { respond: 4 } } } },
    });
    try {
      sla.addUser('ada');
      sla.addUser('agent', { isAgent: true });
      await sla.call('PUT', 'agent/settings', {
        user: 'agent',
        body: { closed: [{ date: '2026-12-24' }, { date: '2026-12-25' }] },
      });
      // Wednesday 23 December 16:00 CET: one open hour that day, three on Monday.
      clock('2026-12-23T15:00:00Z');
      const res = await sla.call('POST', 'widget/conversations', {
        user: 'ada',
        body: { inbox: 'support', type: 'question', body: 'Export?' },
      });
      const row = await sla.findOne('conversation', {
        id: res.data.conversation.id,
      });
      // The app's clock steps a millisecond per write, so to the second.
      expect(Math.round((row?.respondBy?.getTime() ?? 0) / 1000) * 1000).toBe(
        Date.parse('2026-12-28T10:00:00Z')
      );
    } finally {
      await sla.close();
    }
  });
});
