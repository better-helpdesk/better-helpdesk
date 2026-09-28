import { describe, expect, it } from 'vitest';

import { hrefForRoute, routeFromLocation } from './context';

describe('admin routes', () => {
  it.each([
    ['/support/conversations/', {}],
    ['/support/conversations/?status=open&q=csv', { status: 'open', q: 'csv' }],
    ['/support/conversations/c1/', { conversation: 'c1' }],
    ['/support/contacts/', { view: 'contacts' }],
    ['/support/contacts/p1/', { contact: 'p1' }],
    ['/support/companies/o1/', { company: 'o1' }],
    ['/support/deals/', { view: 'deals' }],
  ])('round-trips %s', (href, route) => {
    const [pathname = '', search = ''] = href.split('?');
    expect(routeFromLocation('/support', pathname, search)).toEqual(route);
    expect(hrefForRoute('/support', route)).toBe(href);
  });

  it('reads the bare base path as the inbox', () => {
    expect(routeFromLocation('/support', '/support/', '')).toEqual({});
  });
});
