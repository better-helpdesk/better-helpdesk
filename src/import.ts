import type { HelpdeskStore } from './db/store';

/** Rows of an RFC 4180 file as objects keyed by its header, which is trimmed and lower-cased. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = text.replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header = [], ...body] = rows.filter(r => r.some(v => v.trim() !== ''));
  const keys = header.map(k => k.trim().toLowerCase());
  return body.map(r =>
    Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()]))
  );
}

export type ImportReport = {
  created: number;
  updated: number;
  skipped: number;
};

const list = (value: string | undefined) =>
  (value ?? '')
    .split(/[;|]/)
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);

/**
 * Contacts by `email` (required), with `name`, `tags` (split on `;` or `|`),
 * `lead_stage`, and a company: the one with the row's `domain`, or with the
 * email's domain when only `company` is given, made when missing. A contact
 * whose email is already known is updated, so the import can run again.
 */
export async function importContacts(
  store: HelpdeskStore,
  rows: Record<string, string>[]
): Promise<ImportReport> {
  const report = { created: 0, updated: 0, skipped: 0 };
  for (const row of rows) {
    const email = row.email?.toLowerCase();
    if (!email?.includes('@')) {
      report.skipped++;
      continue;
    }
    const domain =
      row.domain?.toLowerCase() ||
      (row.company ? email.split('@')[1] : undefined);
    let companyId: string | undefined;
    if (domain) {
      const company =
        (await store.findCompanyByDomain(domain)) ??
        (await store.createCompany({ name: row.company || domain, domain }));
      if (row.company && company.name !== row.company) {
        await store.updateCompany(company.id, { name: row.company });
      }
      companyId = company.id;
    }
    const values = {
      email,
      ...(row.name && { name: row.name }),
      ...(row.lead_stage && { leadStage: row.lead_stage }),
      ...(companyId && { companyId }),
    };
    const tags = list(row.tags);
    const known =
      (await store.findContactByIdentity('email', email, {
        verifiedOnly: false,
      })) ?? (await store.findContactByEmail(email));
    if (known) {
      await store.updateContact(known.id, {
        ...values,
        ...(tags.length > 0 && {
          tags: [...new Set([...known.tags, ...tags])],
        }),
      });
      report.updated++;
    } else {
      await store.createContact(
        { ...values, tags },
        { channel: 'email', externalId: email, verified: false }
      );
      report.created++;
    }
  }
  return report;
}

/** Canned replies by `title` and `body`, with an optional `locale`; one with the same title and locale is left alone. */
export async function importCannedReplies(
  store: HelpdeskStore,
  rows: Record<string, string>[]
): Promise<ImportReport> {
  const report = { created: 0, updated: 0, skipped: 0 };
  const existing = new Set(
    (await store.listCannedReplies()).map(r => `${r.title}\n${r.locale ?? ''}`)
  );
  for (const row of rows) {
    const locale =
      row.locale === 'en' || row.locale === 'de' ? row.locale : null;
    const key = `${row.title}\n${locale ?? ''}`;
    if (!row.title || !row.body || existing.has(key)) {
      report.skipped++;
      continue;
    }
    await store.createCannedReply({ title: row.title, body: row.body, locale });
    existing.add(key);
    report.created++;
  }
  return report;
}
