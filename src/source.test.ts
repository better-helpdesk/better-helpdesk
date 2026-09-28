import { describe, expect, it } from 'vitest';

import { sourceOf } from './source';

describe('sourceOf', () => {
  it('names the channel and keeps the campaign', () => {
    expect(
      sourceOf({
        utm: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'q2' },
        referrer: 'https://www.google.com/',
      })
    ).toBe('Google Ads · q2');
    expect(sourceOf({ utm: { utm_source: 'partnerblog' } })).toBe(
      'Partnerblog'
    );
  });

  it('falls back to the referring site, then to nothing', () => {
    expect(sourceOf({ referrer: 'https://www.linkedin.com/feed/' })).toBe(
      'LinkedIn'
    );
    expect(sourceOf({ referrer: 'not a url' })).toBeNull();
    expect(sourceOf({})).toBeNull();
  });
});
