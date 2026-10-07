import { afterEach, describe, expect, it } from 'vitest';

import robots from './robots';

const before = process.env.SITE_URL;
afterEach(() => {
  process.env.SITE_URL = before;
});

describe('robots.txt', () => {
  it('opens the canonical host to crawlers, AI ones by name, and lists the sitemap', () => {
    process.env.SITE_URL = 'https://better-helpdesk.com';
    const result = robots();
    const rules = [result.rules].flat();
    expect(rules).toHaveLength(2);
    for (const rule of rules) {
      expect(rule.allow).toBe('/');
      expect(rule.disallow).toEqual(
        expect.arrayContaining(['/helpdesk/', '/api/', '/demo/api/'])
      );
    }
    expect(rules[1]?.userAgent).toEqual(
      expect.arrayContaining(['GPTBot', 'ClaudeBot', 'PerplexityBot'])
    );
    expect(result.sitemap).toBe('https://better-helpdesk.com/sitemap.xml');
  });

  it('keeps stage and every other host out of the index', () => {
    process.env.SITE_URL = 'https://better-helpdesk-stage.us.aldryn.io';
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });
});
