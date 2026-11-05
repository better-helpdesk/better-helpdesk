import { expect, test } from 'vitest';

import { swissHolidays } from './holidays-ch';

test('places the Easter holidays of 2026 and 2027', () => {
  expect(swissHolidays(2026)).toEqual([
    '2026-01-01',
    '2026-04-03',
    '2026-04-06',
    '2026-05-14',
    '2026-05-25',
    '2026-08-01',
    '2026-12-25',
    '2026-12-26',
  ]);
  // Easter 2027 is on 28 March.
  expect(swissHolidays(2027).slice(1, 5)).toEqual([
    '2027-03-26',
    '2027-03-29',
    '2027-05-06',
    '2027-05-17',
  ]);
});
