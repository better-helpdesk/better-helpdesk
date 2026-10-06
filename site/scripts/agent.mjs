// Creates an agent account, or sets a new password on an existing one:
//   pnpm --filter better-helpdesk-site agent you@example.com "Your Name"
import { betterAuth } from 'better-auth';
import pg from 'pg';

import { authSchema } from './auth-schema.mjs';

const [email, name] = process.argv.slice(2);
if (!email) {
  console.error('Usage: agent <email> [name]');
  process.exit(1);
}

async function askPassword() {
  if (process.env.AGENT_PASSWORD) return process.env.AGENT_PASSWORD;
  if (!process.stdin.isTTY) {
    console.error('Set AGENT_PASSWORD when not running in a terminal.');
    process.exit(1);
  }
  process.stdout.write('Password (12 characters or more): ');
  process.stdin.setRawMode(true);
  let value = '';
  for await (const chunk of process.stdin) {
    for (const ch of chunk.toString('utf8')) {
      if (ch === '\r' || ch === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        return value;
      }
      if (ch === '\u0003') process.exit(130);
      value = ch === '\u007f' ? value.slice(0, -1) : value + ch;
    }
  }
  return value;
}

const password = await askPassword();
if (password.length < 12) {
  console.error('Use at least 12 characters.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'no-verify'
      ? { rejectUnauthorized: false }
      : process.env.DATABASE_SSL === 'true',
});
const auth = betterAuth({
  ...authSchema(pool),
  secret: process.env.BETTER_AUTH_SECRET,
  logger: { disabled: true },
});
const ctx = await auth.$context;
const existing = await ctx.internalAdapter.findUserByEmail(email);
if (existing) {
  await ctx.internalAdapter.updatePassword(
    existing.user.id,
    await ctx.password.hash(password)
  );
  console.log(`New password set for ${email}.`);
} else {
  await auth.api.signUpEmail({
    body: { email, password, name: name ?? email.split('@')[0] },
  });
  console.log(`Agent ${email} created.`);
}
await pool.end();
