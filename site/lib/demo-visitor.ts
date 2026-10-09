import { createHash } from 'node:crypto';

/**
 * One demo customer per address. A visitor who picks the customer role sees
 * only what was written from their own connection, and the package's
 * per-customer rate limit becomes a per-address one, so minting cookies buys
 * a spammer nothing. The proxy appends the address it saw; everything left of
 * it is the client's to forge.
 */
export function visitorKey(headers: Headers) {
  const address =
    headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
    headers.get('x-real-ip') ||
    'local';
  return createHash('sha256').update(address).digest('hex').slice(0, 12);
}
