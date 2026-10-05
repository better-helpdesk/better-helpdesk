import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
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
  advanced: {
    // next.config.mjs sets trailingSlash, so every path arrives with one.
    skipTrailingSlashes: true,
    // next build loads this module with no database to check against.
    database: {
      validateSchema:
        process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD ? false : undefined,
    },
  },
});

export const currentSession = async () =>
  auth.api.getSession({ headers: await headers() });
