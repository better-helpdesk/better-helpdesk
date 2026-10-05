import { sql } from 'drizzle-orm';
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
    await h.support.store.db.execute(
      sql`UPDATE helpdesk.conversation SET waiting_since = '2026-03-27T16:30:00Z'`
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
