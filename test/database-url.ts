export function testDatabaseUrl() {
  const base = new URL(
    process.env.TEST_DATABASE_URL || 'postgres://postgres@localhost:5433/db'
  );
  base.pathname = `/helpdesk_test${process.env.TEST_DB_PREFIX ? `_${process.env.TEST_DB_PREFIX}` : ''}`;
  return base.toString();
}
