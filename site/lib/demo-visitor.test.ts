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

  it('counts an IPv6 host by its /64, as the anonymous limit does', () => {
    expect(key('2001:db8:1:2::1')).toBe(key('2001:DB8:1:2::2'));
    expect(key('2001:db8:1:2::1')).not.toBe(key('2001:db8:1:3::1'));
    expect(key('::ffff:203.0.113.7')).toBe(key('203.0.113.7'));
  });
});
