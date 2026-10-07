// Run from a scratch directory where the packed tarball is installed, outside
// the repository, with pg as the only database driver: the published entry
// points import, the adapters without the drivers they don't use, an identity
// token round-trips, the standalone widget is built, and the CLI migrates the
// database in HELPDESK_DATABASE_URL.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
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
console.log('smoke: ok');
