import { Resolver } from 'node:dns/promises';

import { authenticate, type DNSResolver } from 'mailauth';

// Real mail carries one or two; each one is a DNS lookup and a body hash.
const MAX_SIGNATURES = 5;
const LOOKUP_TIMEOUT_MS = 5_000;
const DEADLINE_MS = 15_000;

/**
 * Whether the From domain itself signed this message: a valid DKIM signature
 * aligned with the From header. Checked here rather than read from a
 * receiving server's Authentication-Results, so it holds whatever relayed the
 * mail (a routing rule, a forwarder, a webhook provider) as long as the
 * message arrives unmodified.
 */
export async function fromDomainSigned(
  raw: Buffer,
  fromAddress: string,
  resolver?: DNSResolver,
  { deadlineMs = DEADLINE_MS }: { deadlineMs?: number } = {}
): Promise<boolean> {
  if (signatureCount(raw) > MAX_SIGNATURES) return false;
  const lookup = resolver ?? systemResolver();
  const result = await within(
    authenticate(raw, {
      trustReceived: false,
      disableArc: true,
      disableBimi: true,
      disableDmarc: true,
      resolver: (name, type) =>
        within(lookup(name, type), LOOKUP_TIMEOUT_MS, () => {
          throw Object.assign(new Error('DNS lookup timed out'), {
            code: 'ETIMEOUT',
          });
        }),
    }),
    deadlineMs,
    () => null
  );
  if (!result) return false;
  // Alignment is checked against the first From header, the parser reads the
  // last; a second From would let one domain's signature vouch for another.
  const from = result.dkim?.headerFrom ?? [];
  if (
    from.length !== 1 ||
    from[0]?.toLowerCase() !== fromAddress.toLowerCase()
  ) {
    return false;
  }
  // mailauth returns these fields but leaves them out of its types.
  const results = (result.dkim?.results ?? []) as (NonNullable<
    typeof result.dkim
  >['results'][number] & {
    signingHeaders?: { keys?: string };
    canonBodyLengthLimited?: boolean;
  })[];
  return results.some(
    r =>
      r.status.result === 'pass' &&
      Boolean(r.status.aligned) &&
      signsFrom(r.signingHeaders?.keys) &&
      // An `l=` limit leaves the rest of the body free to be appended to.
      !r.canonBodyLengthLimited
  );
}

/** The signature must cover From, or From can be swapped under it. */
export function signsFrom(keys: string | undefined) {
  return (keys ?? '')
    .split(':')
    .some(key => key.trim().toLowerCase() === 'from');
}

export function signatureCount(raw: Buffer) {
  const head = raw.subarray(0, 128 * 1024).toString('latin1');
  const end = head.search(/\r?\n\r?\n/);
  return (
    (end === -1 ? head : head.slice(0, end)).match(/^dkim-signature[ \t]*:/gim)
      ?.length ?? 0
  );
}

function systemResolver(): DNSResolver {
  const dns = new Resolver({ timeout: LOOKUP_TIMEOUT_MS, tries: 2 });
  return (name, type) =>
    dns.resolve(name, type) as unknown as Promise<string[][] | string[]>;
}

/** The promise's value, or `fallback()` once `ms` has passed; the work itself is not cancelled. */
async function within<T, F>(
  promise: Promise<T>,
  ms: number,
  fallback: () => F
): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<F>((resolve, reject) => {
        timer = setTimeout(() => {
          try {
            resolve(fallback());
          } catch (error) {
            reject(error);
          }
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
