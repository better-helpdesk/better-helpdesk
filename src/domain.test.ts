import { describe, expect, it } from 'vitest';

import { formatReference, parseReference } from './domain';

describe('references', () => {
  it('round-trips', () => {
    expect(parseReference('DG', formatReference('DG', 1042))).toBe(1042);
  });

  it('accepts lower case and surrounding whitespace', () => {
    expect(parseReference('DG', ' dg-7 ')).toBe(7);
  });

  it('rejects another prefix or trailing text', () => {
    expect(parseReference('DG', 'DIV-7')).toBeUndefined();
    expect(parseReference('DG', 'DG-7x')).toBeUndefined();
  });
});

describe('deriveSubject', () => {
  it('cuts a long first line at a word boundary with an ellipsis', async () => {
    const { deriveSubject } = await import('./service');
    expect(
      deriveSubject(
        'Hi, we are a Treuhand with 14 clients preparing for ISO 27001. Can devguard handle it?'
      )
    ).toBe(
      'Hi, we are a Treuhand with 14 clients preparing for ISO 27001. Can…'
    );
    expect(deriveSubject('Short one\nmore')).toBe('Short one');
  });
});

describe('ipBucket', () => {
  it('groups an IPv6 host by its /64 and leaves IPv4 alone', async () => {
    const { ipBucket } = await import('./service');
    expect(ipBucket('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(ipBucket('2001:0db8:0001:0002:ffff:1:2:3')).toBe(
      '2001:db8:1:2::/64'
    );
    expect(ipBucket('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipBucket('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(ipBucket('203.0.113.7')).toBe('203.0.113.7');
  });
});
