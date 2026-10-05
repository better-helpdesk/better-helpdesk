import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { headers } from 'next/headers';

import { pool, siteUrl } from './site';

/**
 * Agents sign in with an email and a password. Nobody can sign up from the
 * site: `scripts/agent.mjs` creates accounts, so every account is an agent.
 */
export const auth = betterAuth({
  database: pool,
  baseURL: siteUrl(),
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [nextCookies()],
  // next.config.mjs sets trailingSlash, so every path arrives with one.
  advanced: { skipTrailingSlashes: true },
});

export const currentSession = async () =>
  auth.api.getSession({ headers: await headers() });
