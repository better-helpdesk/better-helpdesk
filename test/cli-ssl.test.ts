import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const connectionParameters = pathToFileURL(
  createRequire(import.meta.url).resolve('pg/lib/connection-parameters.js')
).href;

// Stands in for pg: prints the TLS settings pg would connect with, then exits.
const fakePg = `
import ConnectionParameters from ${JSON.stringify(connectionParameters)};
export default {
  Pool: class {
    constructor(config) {
      console.log(JSON.stringify(new ConnectionParameters(config).ssl));
      process.exit(0);
    }
  },
};`;
const fakeDist = `
export const parseCsv = () => [];
export const importContacts = () => {};
export const importCannedReplies = () => {};
export const postgresAdapter = () => {};
export const mysqlAdapter = () => {};
export const mssqlAdapter = () => {};
export const sqliteAdapter = () => {};
export const createStore = () => {};
export const migrate = async () => [];`;
const hooks = `
import { registerHooks } from 'node:module';
const module = source => ({ url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true });
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'pg') return module(${JSON.stringify(fakePg)});
    if (specifier.startsWith('../dist/')) return module(${JSON.stringify(fakeDist)});
    return next(specifier, context);
  },
});`;

function sslFor(
  bin: string,
  args: string[],
  ssl: string | undefined,
  url = 'postgres://postgres@db.test:5432/app'
) {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH };
  env.HELPDESK_DATABASE_URL = url;
  if (ssl !== undefined) env.DATABASE_SSL = ssl;
  const output = execFileSync(
    'node',
    [
      `--import=data:text/javascript,${encodeURIComponent(hooks)}`,
      fileURLToPath(new URL(`../bin/${bin}`, import.meta.url)),
      ...args,
    ],
    { env, encoding: 'utf8' }
  );
  return JSON.parse(output);
}

describe.each([
  ['migrate.mjs', []],
  ['import.mjs', ['contacts', fileURLToPath(import.meta.url)]],
])('DATABASE_SSL in %s', (bin, args) => {
  it('connects without TLS when unset or set to anything else', () => {
    expect(sslFor(bin, args, undefined)).toBe(false);
    expect(sslFor(bin, args, 'false')).toBe(false);
  });

  it('verifies the server certificate when true', () => {
    expect(sslFor(bin, args, 'true')).toBe(true);
  });

  it('accepts any certificate only when no-verify', () => {
    expect(sslFor(bin, args, 'no-verify')).toEqual({
      rejectUnauthorized: false,
    });
  });

  it('gives way to an sslmode in the connection string', () => {
    expect(
      sslFor(bin, args, 'true', 'postgres://db.test/app?sslmode=disable')
    ).toBe(false);
    expect(
      sslFor(
        bin,
        args,
        'no-verify',
        'postgres://db.test/app?sslmode=verify-full'
      )
    ).toEqual({});
  });
});

describe('the database a URL names', () => {
  it('refuses a scheme it has no adapter for, saying so', () => {
    expect(() =>
      execFileSync(
        'node',
        [
          `--import=data:text/javascript,${encodeURIComponent(hooks)}`,
          fileURLToPath(new URL('../bin/migrate.mjs', import.meta.url)),
        ],
        {
          env: {
            PATH: process.env.PATH,
            HELPDESK_DATABASE_URL: 'oracle://db.test/app',
          },
          encoding: 'utf8',
          stdio: 'pipe',
        }
      )
    ).toThrow(/no adapter for oracle:/);
  });
});
