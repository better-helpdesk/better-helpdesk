import { describe, expect, it } from 'vitest';

import { mysqlAdapter } from './kysely';

const pool = (connectionConfig: Record<string, unknown>) =>
  ({ config: { connectionConfig } }) as unknown as Parameters<
    typeof mysqlAdapter
  >[0]['pool'];

describe('mysqlAdapter', () => {
  it('refuses a pool that converts times in a zone other than UTC', () => {
    expect(() => mysqlAdapter({ pool: pool({ timezone: 'local' }) })).toThrow(
      /timezone: 'Z'/
    );
    expect(() =>
      mysqlAdapter({ pool: pool({ timezone: 'Z', dateStrings: true }) })
    ).toThrow(/dateStrings/);
  });

  it('takes a pool in UTC', () => {
    expect(() => mysqlAdapter({ pool: pool({ timezone: 'Z' }) })).not.toThrow();
  });
});
