export function databaseOf(url: string): {
  family: 'postgres' | 'mysql' | 'mssql' | 'sqlite' | undefined;
  path?: string;
  scheme?: string;
};
