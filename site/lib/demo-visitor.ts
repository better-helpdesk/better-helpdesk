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
  return createHash('sha256')
    .update(bucket(address))
    .digest('hex')
    .slice(0, 12);
}

// The same bucket the package's anonymous limit uses: an IPv6 host owns its
// whole /64, so a visitor cannot mint a Nadia per address out of one.
function bucket(ip: string) {
  const address = ip.replace(/%.*$/, '').toLowerCase();
  if (!address.includes(':')) return address;
  const mapped = address.match(/:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return mapped[1];
  const [head = '', tail] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return `${groups
    .slice(0, 4)
    .map(g => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}
