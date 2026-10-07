// Runs the integration suite on every database it can reach: Postgres with
// and without its native queries, SQLite in-process, and MySQL and SQL
// Server when TEST_MYSQL_URL and TEST_MSSQL_URL name a server. TEST_DB picks one.
import { spawnSync } from 'node:child_process';

const runs = [
  { name: 'postgres', env: { TEST_DB: 'postgres' } },
  {
    name: 'postgres without capabilities',
    env: {
      TEST_DB: 'postgres',
      TEST_PORTABLE: '1',
      TEST_DB_PREFIX: `${process.env.TEST_DB_PREFIX ?? ''}portable`,
    },
  },
  { name: 'sqlite', env: { TEST_DB: 'sqlite' } },
  // The example adapter that implements the contract alone, without capabilities.
  { name: 'memory', env: { TEST_DB: 'memory' } },
  ...(process.env.TEST_MYSQL_URL
    ? [{ name: 'mysql', env: { TEST_DB: 'mysql' } }]
    : []),
  ...(process.env.TEST_MSSQL_URL
    ? [{ name: 'sql server', env: { TEST_DB: 'mssql' } }]
    : []),
];
const only = process.env.TEST_DB;
if (only && !runs.some(run => run.env.TEST_DB === only)) {
  console.error(`No integration run for TEST_DB=${only}`);
  process.exit(1);
}
const args = process.argv.slice(2);

let failed = false;
for (const run of runs) {
  if (only && run.env.TEST_DB !== only) continue;
  console.log(`\n=== integration tests on ${run.name} ===`);
  const { status } = spawnSync(
    'vitest',
    ['run', '--config', 'vitest.integration.config.ts', ...args],
    { stdio: 'inherit', env: { ...process.env, ...run.env }, shell: false }
  );
  if (status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
