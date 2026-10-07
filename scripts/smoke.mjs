// Run from a scratch directory where the packed tarball is installed, outside
// the repository, with pg as the only database driver: the published entry
// points import, the adapters without the drivers they don't use, an identity
// token round-trips, the standalone widget is built, the CLI migrates the
// database in HELPDESK_DATABASE_URL, and the import CLI writes contacts and
// canned replies into it.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = createRequire(join(process.cwd(), 'noop.js'));
const load = name => import(pathToFileURL(here.resolve(name)).href);

const helpdesk = await load('better-helpdesk');
const token = helpdesk.signIdentityToken({ sub: 'u' }, 's');
if (helpdesk.verifyIdentityToken(token, 's')?.user.id !== 'u') {
  throw new Error('smoke: an identity token did not round-trip');
}
await load('better-helpdesk/rich');
const testing = await load('better-helpdesk/testing');
if (typeof testing.runAdapterTests !== 'function') {
  throw new Error('smoke: better-helpdesk/testing has no runAdapterTests');
}
// Neither mysql2 nor tedious is installed here: the adapters load without them.
const adapters = await load('better-helpdesk/adapters');
if (adapters.postgresAdapter !== helpdesk.postgresAdapter) {
  throw new Error('smoke: better-helpdesk/adapters is not the same module');
}

const root = join(process.cwd(), 'node_modules/better-helpdesk');
const widget = join(root, 'dist/widget.js');
if (!existsSync(widget) || statSync(widget).size === 0) {
  throw new Error('smoke: dist/widget.js is missing');
}
execFileSync(process.execPath, [join(root, 'bin/migrate.mjs')], {
  stdio: 'inherit',
});

// Unique per run, so a rerun against the same database still creates both.
const run = randomUUID();
const dir = mkdtempSync(join(tmpdir(), 'helpdesk-smoke-'));
const csv = {
  contacts: `email,name\na-${run}@smoke.test,Ada\nb-${run}@smoke.test,Ben\n`,
  canned: `title,body\nHello ${run},Hi there\nBye ${run},See you\n`,
};
for (const [kind, text] of Object.entries(csv)) {
  const file = join(dir, `${kind}.csv`);
  writeFileSync(file, text);
  const out = execFileSync(
    process.execPath,
    [join(root, 'bin/import.mjs'), kind, file],
    { encoding: 'utf8' }
  );
  if (!out.includes('2 created')) {
    throw new Error(`smoke: importing ${kind} printed: ${out}`);
  }
}
console.log('smoke: ok');
