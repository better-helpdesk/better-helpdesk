import { expect, it } from 'vitest';

import { snoozePresets } from './snooze';

const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min);

it('offers later today, tomorrow morning and next Monday morning in local time', () => {
  expect(snoozePresets(at(2026, 10, 7, 10, 30))).toEqual([
    ['laterToday', at(2026, 10, 7, 18)],
    ['tomorrow', at(2026, 10, 8, 9)],
    ['nextWeek', at(2026, 10, 12, 9)],
  ]);
});

it('drops later today from 18:00 on', () => {
  expect(snoozePresets(at(2026, 10, 7, 18)).map(([key]) => key)).toEqual([
    'tomorrow',
    'nextWeek',
  ]);
});

it('offers next Monday a week out on a Monday, and once on a Sunday', () => {
  expect(snoozePresets(at(2026, 10, 5, 8)).at(-1)).toEqual([
    'nextWeek',
    at(2026, 10, 12, 9),
  ]);
  expect(snoozePresets(at(2026, 10, 11, 20))).toEqual([
    ['tomorrow', at(2026, 10, 12, 9)],
  ]);
});
