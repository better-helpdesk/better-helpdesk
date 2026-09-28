import { authenticate, type DNSResolver } from 'mailauth';

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
  resolver?: DNSResolver
): Promise<boolean> {
  const result = await authenticate(raw, {
    trustReceived: false,
    disableArc: true,
    disableBimi: true,
    disableDmarc: true,
    resolver,
  });
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
