import { describe, expect, it } from 'vitest';

import { type BusinessHours, resolveConfig } from '../config';
import {
  nextOpening,
  openCutoff,
  openDeadline,
  openHoursBetween,
} from './hours';

const office: BusinessHours = {
  timeZone: 'Europe/Zurich',
  weekly: Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri'].map(d => [d, [['08:00', '17:00']]])
  ),
};

const at = (iso: string) => new Date(iso);

describe('openHoursBetween', () => {
  it('counts nothing over a closed weekend', () => {
    // Friday 17:30 CET to Monday 10:00 CEST, across the March change.
    expect(
      openHoursBetween(
        at('2026-03-27T16:30:00Z'),
        at('2026-03-30T08:00:00Z'),
        office
      )
    ).toBe(2);
  });

  it('opens at 08:00 local on both sides of a DST change', () => {
    expect(
      openHoursBetween(
        at('2026-03-27T07:00:00Z'),
        at('2026-03-30T15:00:00Z'),
        office
      )
    ).toBe(18);
    expect(
      openHoursBetween(
        at('2026-10-23T06:00:00Z'),
        at('2026-10-26T16:00:00Z'),
        office
      )
    ).toBe(18);
  });

  it('counts a day with an hour fewer when the clocks go forward', () => {
    const sundays: BusinessHours = {
      timeZone: 'Europe/Zurich',
      weekly: { sun: [['00:00', '24:00']] },
    };
    expect(
      openHoursBetween(
        at('2026-03-27T00:00:00Z'),
        at('2026-04-01T00:00:00Z'),
        sundays
      )
    ).toBe(23);
    expect(
      openHoursBetween(
        at('2026-10-23T00:00:00Z'),
        at('2026-10-28T00:00:00Z'),
        sundays
      )
    ).toBe(25);
  });

  it('runs an overnight span into the next day', () => {
    const nights: BusinessHours = {
      timeZone: 'Europe/Zurich',
      weekly: { sat: [['22:00', '02:00']] },
    };
    expect(
      openHoursBetween(
        at('2026-10-02T00:00:00Z'),
        at('2026-10-05T00:00:00Z'),
        nights
      )
    ).toBe(4);
    // Saturday 23:00 local, an hour into the span.
    expect(
      openHoursBetween(
        at('2026-10-03T21:00:00Z'),
        at('2026-10-05T00:00:00Z'),
        nights
      )
    ).toBe(3);
    // The October night has an hour more.
    expect(
      openHoursBetween(
        at('2026-10-23T00:00:00Z'),
        at('2026-10-26T00:00:00Z'),
        nights
      )
    ).toBe(5);
  });

  it('counts overlapping spans once', () => {
    const overlap: BusinessHours = {
      timeZone: 'UTC',
      weekly: {
        mon: [
          ['08:00', '12:00'],
          ['10:00', '14:00'],
        ],
      },
    };
    expect(
      openHoursBetween(
        at('2026-10-05T00:00:00Z'),
        at('2026-10-06T00:00:00Z'),
        overlap
      )
    ).toBe(6);
  });
});

describe('openCutoff', () => {
  it('is the latest start that has had that much open time by now', () => {
    // Monday 14:00 CEST: six open hours back reach Monday 08:00.
    expect(openCutoff(at('2026-03-30T12:00:00Z'), 6, office)).toEqual(
      at('2026-03-30T06:00:00Z')
    );
    // Monday 10:00 CEST: the other four come from Friday before 17:00 CET.
    expect(openCutoff(at('2026-03-30T08:00:00Z'), 6, office)).toEqual(
      at('2026-03-27T12:00:00Z')
    );
  });

  it('agrees with openHoursBetween across weeks', () => {
    const now = at('2026-10-27T09:30:00Z');
    const cutoff = openCutoff(now, 100, office);
    expect(openHoursBetween(cutoff, now, office)).toBe(100);
  });
});

describe('nextOpening', () => {
  it('is the moment itself while open', () => {
    const tuesday = at('2026-10-06T10:00:00Z');
    expect(nextOpening(tuesday, office)).toEqual(tuesday);
  });

  it('is Monday 08:00 local after the October change', () => {
    expect(nextOpening(at('2026-10-24T12:00:00Z'), office)).toEqual(
      at('2026-10-26T07:00:00Z')
    );
  });

  it('is Monday 08:00 local after the March change', () => {
    expect(nextOpening(at('2026-03-27T16:30:00Z'), office)).toEqual(
      at('2026-03-30T06:00:00Z')
    );
  });

  it('opens after a skipped midnight west of UTC', () => {
    // Santiago skips 00:00 to 01:00 on Sunday 6 September.
    const santiago: BusinessHours = {
      timeZone: 'America/Santiago',
      weekly: { sun: [['00:00', '08:00']] },
    };
    expect(nextOpening(at('2026-09-05T16:00:00Z'), santiago)).toEqual(
      at('2026-09-06T04:00:00Z')
    );
  });

  it('moves a skipped 02:30 in New York to 03:30', () => {
    const newYork: BusinessHours = {
      timeZone: 'America/New_York',
      weekly: { sun: [['02:30', '08:00']] },
    };
    expect(nextOpening(at('2026-03-07T17:00:00Z'), newYork)).toEqual(
      at('2026-03-08T07:30:00Z')
    );
  });

  it('opens at the later of a repeated 02:30', () => {
    const zurich: BusinessHours = {
      timeZone: 'Europe/Zurich',
      weekly: { sun: [['02:30', '08:00']] },
    };
    expect(nextOpening(at('2026-10-24T12:00:00Z'), zurich)).toEqual(
      at('2026-10-25T01:30:00Z')
    );
  });
});

describe('hours in the config', () => {
  const config = (hours: unknown) => ({
    db: {} as never,
    referencePrefix: 'DG',
    adminUrl: 'https://app.test/',
    identify: async () => null,
    inboxes: { support: { hours: hours as BusinessHours } },
  });

  it.each(['Europe/Zurich', 'Asia/Kolkata', 'UTC'])(
    'accepts a schedule in %s',
    timeZone => {
      expect(() =>
        resolveConfig(config({ ...office, timeZone }))
      ).not.toThrow();
    }
  );

  it.each([
    ['an unknown time zone', { ...office, timeZone: 'Europe/Nowhere' }],
    ['an offset time zone', { ...office, timeZone: '+01:00' }],
    [
      'a malformed time',
      { timeZone: 'UTC', weekly: { mon: [['8:00', '17:00']] } },
    ],
    [
      'a span starting at 24:00',
      { timeZone: 'UTC', weekly: { mon: [['24:00', '08:00']] } },
    ],
    ['an unknown day', { timeZone: 'UTC', weekly: { monday: [] } }],
    ['no open span', { timeZone: 'UTC', weekly: { mon: [] } }],
  ])('rejects %s', (_, hours) => {
    expect(() => resolveConfig(config(hours))).toThrow(/support/);
  });
});

describe('openDeadline', () => {
  it('is the mirror of openCutoff', () => {
    const due = openDeadline(at('2026-03-27T16:30:00Z'), 6, office);
    // Friday after closing: six open hours end at 14:00 CEST on Monday, and
    // looking back from there they began when Monday opened.
    expect(due).toEqual(at('2026-03-30T12:00:00Z'));
    expect(openCutoff(due, 6, office)).toEqual(at('2026-03-30T06:00:00Z'));
  });

  it('starts counting at the next opening', () => {
    expect(openDeadline(at('2026-10-24T12:00:00Z'), 0, office)).toEqual(
      at('2026-10-26T07:00:00Z')
    );
  });
});

describe('closed days', () => {
  // Christmas 2026 falls on a Friday; the 24th is a Thursday.
  const holidays: BusinessHours = {
    ...office,
    closed: [
      '2026-12-24',
      '2026-12-25',
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
    ],
  };

  it('counts no open time on a closed day', () => {
    expect(
      openHoursBetween(
        at('2026-12-24T00:00:00Z'),
        at('2026-12-26T00:00:00Z'),
        holidays
      )
    ).toBe(0);
    expect(
      openHoursBetween(
        at('2026-12-24T00:00:00Z'),
        at('2026-12-26T00:00:00Z'),
        office
      )
    ).toBe(18);
  });

  it('carries a deadline over the closed days to the next open one', () => {
    // Wednesday 23rd 16:00 CET, four open hours: one that day, three on Monday 4 January.
    expect(openDeadline(at('2026-12-23T15:00:00Z'), 4, holidays)).toEqual(
      at('2027-01-04T10:00:00Z')
    );
  });

  it('opens on the first day after a closure longer than a week', () => {
    expect(nextOpening(at('2026-12-23T17:00:00Z'), holidays)).toEqual(
      at('2027-01-04T07:00:00Z')
    );
  });

  it('keeps a span that started the evening before running into a closed day', () => {
    const night: BusinessHours = {
      timeZone: 'Europe/Zurich',
      weekly: { thu: [['22:00', '02:00']] },
      closed: ['2026-12-25'],
    };
    // Thursday 24th 22:00 to Friday 25th 02:00 CET still counts.
    expect(
      openHoursBetween(
        at('2026-12-24T20:00:00Z'),
        at('2026-12-25T02:00:00Z'),
        night
      )
    ).toBe(4);
  });

  it('refuses a date that does not exist', () => {
    expect(() =>
      resolveConfig({
        db: {} as never,
        referencePrefix: 'DG',
        adminUrl: 'https://app.test/helpdesk/',
        identify: async () => null,
        inboxes: { support: { hours: { ...office, closed: ['2026-02-30'] } } },
      })
    ).toThrow(/Not a calendar date/);
  });
});
