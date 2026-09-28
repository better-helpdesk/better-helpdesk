import { describe, expect, it } from 'vitest';

import { browserLabel, humanizeKey, initials } from './ui';

describe('agent UI helpers', () => {
  it('names a browser and OS from a user agent', () => {
    expect(
      browserLabel(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'
      )
    ).toBe('Chrome 153 · macOS');
    expect(
      browserLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'
      )
    ).toBe('Edge 140 · Windows');
  });

  it('turns keys and names into labels and initials', () => {
    expect(humanizeKey('appVersion')).toBe('App Version');
    expect(initials('Sandra Keller')).toBe('SK');
    expect(initials('julia@nordwind-labs.de')).toBe('J');
  });
});
