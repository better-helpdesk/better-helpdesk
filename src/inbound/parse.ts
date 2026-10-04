import { simpleParser } from 'mailparser';

import type { InboundMessage } from '../config';

const QUOTE_START = [
  /^on .+ wrote:?\s*$/i,
  /^am .+ schrieb\b.*:\s*$/i,
  /^-{2,}\s*(original message|ursprüngliche nachricht)/i,
  /^_{5,}$/,
  /^(from|von):\s.+/i,
];

/** Drops the quoted history under a reply, keeping what the sender wrote. */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  // A quote header is one short line; the patterns backtrack on long ones.
  const cut = lines.findIndex(
    line => line.length <= 500 && QUOTE_START.some(re => re.test(line.trim()))
  );
  const kept = cut === -1 ? lines : lines.slice(0, cut);
  while (
    kept.length &&
    (kept.at(-1)?.trim() === '' || kept.at(-1)?.startsWith('>'))
  ) {
    kept.pop();
  }
  const result = kept.join('\n').trim();
  return result || text.trim();
}

/** RFC 3834, the `Precedence` and `X-Autoreply` conventions, and delivery reports. */
export function isAutomated(
  headers: Map<string, unknown>,
  fromAddress: string
) {
  const value = (key: string) => String(headers.get(key) ?? '').trim();
  const submitted = value('auto-submitted').toLowerCase();
  if (submitted && !submitted.startsWith('no')) return true;
  if (/^(bulk|junk|auto_reply)$/i.test(value('precedence'))) return true;
  if (headers.has('x-autoreply') || headers.has('x-autorespond')) return true;
  const type = headers.get('content-type') as { value?: string } | undefined;
  if (type?.value?.toLowerCase() === 'multipart/report') return true;
  return /^(mailer-daemon|postmaster)@/i.test(fromAddress);
}

export type SenderCheck = (
  raw: Buffer,
  fromAddress: string
) => Promise<boolean>;

export async function toInbound(
  source: Buffer,
  verify: SenderCheck
): Promise<InboundMessage> {
  // The text comes from the plain part when there is one; a huge HTML part
  // only costs a conversion nobody reads past the 20,000-character cap.
  const parsed = await simpleParser(source, {
    maxHtmlLengthToParse: 1024 * 1024,
  });
  const from = parsed.from?.value[0];
  const address = from?.address ?? '';
  const addresses = (field: typeof parsed.to) =>
    (Array.isArray(field) ? field : field ? [field] : []).flatMap(a =>
      a.value.map(v => v.address ?? '').filter(Boolean)
    );
  const references = parsed.references;
  return {
    messageId:
      parsed.messageId ??
      `<${parsed.date?.getTime() ?? Date.now()}.${address}>`,
    from: { address, name: from?.name || undefined },
    to: [...addresses(parsed.to), ...addresses(parsed.cc)],
    subject: parsed.subject ?? '',
    // The same cap the composers enforce.
    text: stripQuoted(parsed.text ?? '').slice(0, 20_000),
    inReplyTo: parsed.inReplyTo,
    references: Array.isArray(references)
      ? references
      : references
        ? [references]
        : [],
    verified: address ? await verify(source, address) : false,
    automated: isAutomated(parsed.headers, address),
    attachments: parsed.attachments.map(a => ({
      filename: a.filename || 'attachment',
      contentType: a.contentType,
      content: new Uint8Array(a.content),
    })),
  };
}
