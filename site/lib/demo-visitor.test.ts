import { describe, expect, it } from 'vitest';

import { visitorKey } from './demo-visitor';

const key = (forwarded?: string) =>
  visitorKey(new Headers(forwarded ? { 'x-forwarded-for': forwarded } : {}));

describe('visitorKey', () => {
  it('is the same for one address and differs between addresses', () => {
    expect(key('203.0.113.7')).toBe(key('203.0.113.7'));
    expect(key('203.0.113.7')).not.toBe(key('203.0.113.8'));
    expect(key()).toBe(key());
  });

  it('trusts only the address the proxy appended', () => {
    expect(key('1.1.1.1, 203.0.113.7')).toBe(key('2.2.2.2, 203.0.113.7'));
    expect(key('1.1.1.1, 203.0.113.7')).not.toBe(key('1.1.1.1'));
  });
});
