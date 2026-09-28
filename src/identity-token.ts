import { createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import type { Identity } from './config';

const claims = z.object({
  sub: z.string().min(1).max(200),
  exp: z.number().int(),
  email: z.email().max(320).optional(),
  email_verified: z.boolean().optional(),
  name: z.string().max(200).optional(),
  locale: z.string().max(35).optional(),
  orgs: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        name: z.string().max(200).optional(),
      })
    )
    .max(100)
    .default([]),
});

export type IdentityClaims = z.input<typeof claims>;

const HEADER = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'JWT' })
).toString('base64url');

const sign = (input: string, secret: string) =>
  createHmac('sha256', secret).update(input).digest();

/** An HS256 JWT for `x-helpdesk-identity`; any JWT library signing the same claims works as well. */
export function signIdentityToken(
  payload: Omit<IdentityClaims, 'exp'>,
  secret: string,
  { expiresInSeconds = 3600 }: { expiresInSeconds?: number } = {}
) {
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    })
  ).toString('base64url');
  return `${HEADER}.${body}.${sign(`${HEADER}.${body}`, secret).toString('base64url')}`;
}

/** The customer a host vouches for, or null when the token is forged, malformed or expired. A token never makes an agent. */
export function verifyIdentityToken(
  token: string,
  secret: string
): Identity | null {
  const [header, body, signature, ...rest] = token.split('.');
  if (!header || !body || !signature || rest.length > 0) return null;
  const expected = sign(`${header}.${body}`, secret);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  if (parse(header)?.alg !== 'HS256') return null;
  const parsed = claims.safeParse(parse(body));
  if (!parsed.success || parsed.data.exp <= Date.now() / 1000) return null;
  const c = parsed.data;
  return {
    user: {
      id: c.sub,
      email: c.email ?? null,
      emailVerified: c.email_verified ?? false,
      name: c.name ?? null,
      locale: c.locale ?? null,
    },
    orgs: c.orgs,
    isAgent: false,
  };
}

function parse(segment: string) {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
