import { describe, expect, it } from 'vitest';

import { type BusinessHours, resolveConfig } from './config';
import { deadline, slaClockFor, slaPatch, slaStart, targetHours } from './sla';

const office: BusinessHours = {
  timeZone: 'Europe/Zurich',
  weekly: Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri'].map(d => [d, [['08:00', '17:00']]])
  ),
};
const at = (iso: string) => new Date(iso);
const clock = { hours: null, respond: 4, resolve: 24, reply: null };

const fresh = (status = 'open', createdAt = at('2026-10-20T10:00:00Z')) => ({
  status,
  createdAt,
  firstRespondedAt: null,
  respondBy: null,
  resolveBy: null,
  slaPausedAt: null,
  slaPausedSeconds: 0,
  respondNotice: null,
  resolveNotice: null,
  replySince: null,
  replyBy: null,
  replyNotice: null,
});

describe('deadline', () => {
  it('adds plain hours without a schedule', () => {
    expect(deadline(at('2026-10-20T10:00:00Z'), 4, null)).toEqual(
      at('2026-10-20T14:00:00Z')
    );
  });

  it('counts open hours only, past a weekend', () => {
    // Friday 16:00 CEST plus 4 open hours: one left on Friday, three on Monday.
    expect(deadline(at('2026-10-23T14:00:00Z'), 4, office)).toEqual(
      at('2026-10-26T10:00:00Z')
    );
  });

  it('starts at the next opening when the clock starts while closed', () => {
    expect(deadline(at('2026-10-24T12:00:00Z'), 1, office)).toEqual(
      at('2026-10-26T08:00:00Z')
    );
  });
});

describe('slaClockFor', () => {
  const config = {
    inboxes: { support: { hours: office }, sales: {} },
    teamClosed: [] as string[],
    sla: {
      tiers: {
        gold: {
          targets: { urgent: { respond: 4, hours: 'always' as const } },
        },
      },
      default: { targets: { normal: { respond: 24, resolve: 72 } } },
    },
  };
  const clockFor = slaClockFor(config);

  it('takes the tier policy, the default for a tier without one, and nothing for a priority the policy leaves out', () => {
    expect(
      clockFor({ inbox: 'sales', tier: 'gold', priority: 'urgent' })
    ).toEqual({ hours: null, respond: 4, resolve: null, reply: null });
    expect(
      clockFor({ inbox: 'sales', tier: 'gold', priority: 'normal' })
    ).toBeNull();
    expect(
      clockFor({ inbox: 'sales', tier: 'silver', priority: 'normal' })
    ).toEqual({ hours: null, respond: 24, resolve: 72, reply: null });
    expect(
      clockFor({ inbox: 'sales', tier: null, priority: 'low' })
    ).toBeNull();
  });

  it('inherits the inbox hours unless the target or policy says otherwise', () => {
    expect(
      clockFor({ inbox: 'support', tier: null, priority: 'normal' })?.hours
    ).toBe(office);
    expect(
      clockFor({ inbox: 'support', tier: 'gold', priority: 'urgent' })?.hours
    ).toBeNull();
  });

  it('adds the days the team closed to the hours it counts in', () => {
    const closing = { ...config, teamClosed: ['2026-12-24'] };
    const hours = slaClockFor(closing)({
      inbox: 'support',
      tier: null,
      priority: 'normal',
    })?.hours;
    expect(hours?.closed).toEqual(['2026-12-24']);
    expect(hours?.weekly).toBe(office.weekly);
  });

  it('is off without a policy', () => {
    expect(
      slaClockFor({ inboxes: {}, teamClosed: [] })({
        inbox: 'x',
        tier: null,
        priority: 'normal',
      })
    ).toBeNull();
  });
});

describe('slaStart', () => {
  it('sets both deadlines for a waiting customer', () => {
    const now = at('2026-10-20T10:00:00Z');
    expect(
      slaStart(clock, now, { status: 'open', awaitingResponse: true })
    ).toEqual({
      respondBy: at('2026-10-20T14:00:00Z'),
      resolveBy: at('2026-10-21T10:00:00Z'),
      slaPausedAt: null,
      slaDueAt: at('2026-10-20T14:00:00Z'),
    });
  });

  it('pauses at once, without a response target, when the team opened it', () => {
    const now = at('2026-10-20T10:00:00Z');
    expect(
      slaStart(clock, now, { status: 'pending', awaitingResponse: false })
    ).toEqual({
      respondBy: null,
      resolveBy: at('2026-10-21T10:00:00Z'),
      slaPausedAt: now,
      slaDueAt: null,
    });
  });

  it('leaves everything unset without a clock', () => {
    expect(
      slaStart(null, at('2026-10-20T10:00:00Z'), {
        status: 'open',
        awaitingResponse: true,
      })
    ).toEqual({
      respondBy: null,
      resolveBy: null,
      slaPausedAt: null,
      slaDueAt: null,
    });
  });
});

describe('slaPatch', () => {
  const started = {
    ...fresh(),
    respondBy: at('2026-10-20T14:00:00Z'),
    resolveBy: at('2026-10-21T10:00:00Z'),
  };

  it('pauses on a reply and moves the resolution deadline by the pause on the next customer message', () => {
    const replied = at('2026-10-20T11:00:00Z');
    const paused = slaPatch(
      clock,
      started,
      { status: 'pending', firstRespondedAt: replied },
      replied
    );
    expect(paused).toEqual({ slaPausedAt: replied, slaDueAt: null });

    const back = at('2026-10-20T13:00:00Z');
    const resumed = slaPatch(
      clock,
      {
        ...started,
        status: 'pending',
        firstRespondedAt: replied,
        slaPausedAt: replied,
      },
      { status: 'open' },
      back
    );
    expect(resumed).toEqual({
      slaPausedAt: null,
      slaPausedSeconds: 2 * 3600,
      resolveBy: at('2026-10-21T12:00:00Z'),
      slaDueAt: at('2026-10-21T12:00:00Z'),
    });
  });

  it('counts a pause in open hours when the clock has them', () => {
    const hours = { ...clock, hours: office };
    // Paused Friday 16:00 CEST, resumed Monday 10:00 CEST: two open hours.
    const resumed = slaPatch(
      hours,
      {
        ...fresh('pending', at('2026-10-23T12:00:00Z')),
        slaPausedAt: at('2026-10-23T14:00:00Z'),
        resolveBy: at('2026-10-27T13:00:00Z'),
      },
      { status: 'open' },
      at('2026-10-26T08:00:00Z')
    );
    expect(resumed.slaPausedSeconds).toBe(2 * 3600);
  });

  it('sets fresh deadlines on a new tier or priority and forgets a notice whose target moved out', () => {
    const now = at('2026-10-20T15:00:00Z');
    const breached = { ...started, respondNotice: 'breach' as const };
    const longer = slaPatch(
      { hours: null, respond: 8, resolve: 48, reply: null },
      breached,
      { status: 'open', retarget: true },
      now
    );
    expect(longer).toEqual({
      respondBy: at('2026-10-20T18:00:00Z'),
      respondNotice: null,
      resolveBy: at('2026-10-22T10:00:00Z'),
      resolveNotice: null,
      slaDueAt: at('2026-10-20T18:00:00Z'),
    });
    const none = slaPatch(
      null,
      started,
      { status: 'open', retarget: true },
      now
    );
    expect(none).toEqual({ respondBy: null, resolveBy: null, slaDueAt: null });
  });

  it('keeps the response deadline once answered, so the report still says whether it was met', () => {
    const answered = {
      ...started,
      firstRespondedAt: at('2026-10-20T11:00:00Z'),
    };
    const patch = slaPatch(
      { hours: null, respond: 1, resolve: 48, reply: null },
      answered,
      { status: 'open', retarget: true },
      at('2026-10-20T12:00:00Z')
    );
    expect(patch.respondBy).toEqual(started.respondBy);
    expect(patch.slaDueAt).toEqual(at('2026-10-22T10:00:00Z'));
  });

  it('clears the due date while resolved and brings it back on a reopen', () => {
    const resolvedAt = at('2026-10-20T12:00:00Z');
    expect(
      slaPatch(clock, started, { status: 'resolved' }, resolvedAt)
    ).toEqual({ slaPausedAt: resolvedAt, slaDueAt: null });
    const reopened = slaPatch(
      clock,
      { ...started, status: 'resolved', slaPausedAt: resolvedAt },
      { status: 'open' },
      at('2026-10-20T13:00:00Z')
    );
    expect(reopened.slaDueAt).toEqual(started.respondBy);
  });
});

describe('targetHours', () => {
  const office: BusinessHours = {
    timeZone: 'Europe/Zurich',
    weekly: Object.fromEntries(
      ['mon', 'tue', 'wed', 'thu', 'fri'].map(d => [d, [['08:00', '17:00']]])
    ),
  };

  it('takes hours as they are, and a day as the open hours until the same time on the next open day', () => {
    const friday = new Date('2026-11-06T13:00:00Z');
    expect(targetHours(4, friday, office)).toBe(4);
    // Friday 14:00 to 17:00, then Monday 08:00 to 14:00.
    expect(targetHours('1d', friday, office)).toBe(9);
    expect(deadline(friday, targetHours('1d', friday, office), office)).toEqual(
      new Date('2026-11-09T13:00:00Z')
    );
  });

  it('counts a day as 24 hours round the clock', () => {
    expect(targetHours('2d', new Date('2026-11-06T13:00:00Z'), null)).toBe(48);
  });
});

describe('a target in days', () => {
  const build = (respond: unknown) =>
    resolveConfig({
      db: {} as never,
      referencePrefix: 'DG',
      adminUrl: 'https://app.test/helpdesk/',
      identify: async () => null,
      inboxes: { support: {} },
      sla: { default: { targets: { normal: { respond } } } } as never,
    });

  it('takes whole days, and refuses fractions and zero', () => {
    expect(() => build('1d')).not.toThrow();
    expect(() => build('1.5d')).toThrow(/days such as "1d"/);
    expect(() => build('0d')).toThrow(/days such as "1d"/);
  });
});
