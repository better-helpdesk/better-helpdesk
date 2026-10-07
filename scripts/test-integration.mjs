// Runs the integration suite on every database it can reach: Postgres with
// and without its native queries, SQLite in-process, and MySQL or SQL Server
// when TEST_MYSQL_URL or TEST_MSSQL_URL names one.
import { spawnSync } from 'node:child_process';

const runs = [
  { name: 'postgres', env: { TEST_DB: 'postgres' } },
  {
    name: 'postgres without capabilities',
    env: {
      TEST_DB: 'postgres',
      TEST_PORTABLE: '1',
      TEST_DB_PREFIX: 'portable',
    },
  },
  { name: 'sqlite', env: { TEST_DB: 'sqlite' } },
];
const only = process.env.TEST_DB;
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
