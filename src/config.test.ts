import { describe, expect, it } from 'vitest';

import { type HelpdeskConfig, resolveConfig } from './config';

const config = (identityTokenSecret?: string) =>
  ({
    inboxes: { support: {} },
    identityTokenSecret,
  }) as unknown as HelpdeskConfig;

describe('identityTokenSecret', () => {
  it('refuses a secret short enough to guess offline', () => {
    expect(() => resolveConfig(config('helpdesk2026'))).toThrow(
      /identityTokenSecret.*32 bytes/
    );
  });

  it('accepts 32 bytes or more, or none at all', () => {
    expect(() => resolveConfig(config('x'.repeat(32)))).not.toThrow();
    expect(() => resolveConfig(config())).not.toThrow();
  });
});
