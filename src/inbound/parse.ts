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

export type SenderCheck = (
  raw: Buffer,
  fromAddress: string
) => Promise<boolean>;

export async function toInbound(
  source: Buffer,
  verify: SenderCheck
): Promise<InboundMessage> {
  const parsed = await simpleParser(source);
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
    attachments: parsed.attachments.map(a => ({
      filename: a.filename ?? 'attachment',
      contentType: a.contentType,
      content: new Uint8Array(a.content),
    })),
  };
}
