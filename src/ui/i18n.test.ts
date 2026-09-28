import { describe, expect, it } from 'vitest';

import { nextWorkday } from './i18n';

describe('nextWorkday', () => {
  it('skips the weekend', () => {
    // 2026-10-02 is a Friday.
    expect(nextWorkday(new Date('2026-10-02T12:00:00')).getDay()).toBe(1);
    expect(nextWorkday(new Date('2026-10-05T12:00:00')).getDate()).toBe(6);
  });
});
