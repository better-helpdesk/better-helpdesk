import { DEFAULT_LEAD_STAGES } from './config';
import type { HelpdeskStore } from './db/store';

/**
 * Rows of an RFC 4180 file as objects keyed by its header, which is trimmed
 * and lower-cased. A quote opens a quoted field only at the field's start;
 * elsewhere it is a character. An unterminated quote, or text after a closing
 * one, throws with its line, rather than swallowing the rows after it.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  let line = 1;
  let quoteLine = 1;
  const input = text.replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
        closed = true;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(field);
      field = '';
      closed = false;
      if (ch !== ',') {
        if (ch === '\r' && input[i + 1] === '\n') i++;
        rows.push(row);
        row = [];
        line++;
      }
    } else if (closed) {
      throw new Error(`CSV line ${line}: text after a closing quote`);
    } else if (ch === '"' && field === '') {
      quoted = true;
      quoteLine = line;
    } else field += ch;
  }
  if (quoted) {
    throw new Error(`CSV line ${quoteLine}: a quote is never closed`);
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
  /** Values left out, one line each, for the person running the import. */
  notes: string[];
};

// The agent API's limits, so an import stores nothing an agent could not.
const MAX_TAGS = 50;
const MAX_TAG = 50;
const MAX_NAME = 200;
const MAX_BODY = 20_000;

/**
 * Contacts by `email` (required), with `name`, `tags` (split on `;` or `|`),
 * `lead_stage`, and a company: by `domain` when the row has one, otherwise
 * by its `company` name; one is made when missing, and an existing one is
 * never renamed. A known contact only gains what it lacks: empty fields are
 * filled and tags are added, so a rerun never undoes an agent's edit.
 */
export async function importContacts(
  store: HelpdeskStore,
  rows: Record<string, string>[],
  { leadStages = DEFAULT_LEAD_STAGES }: { leadStages?: string[] } = {}
): Promise<ImportReport> {
  const report: ImportReport = {
    created: 0,
    updated: 0,
    skipped: 0,
    notes: [],
  };
  for (const [index, row] of rows.entries()) {
    const at = `row ${index + 2}`;
    const email = row.email?.toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
      report.skipped++;
      report.notes.push(`${at}: no usable email, skipped`);
      continue;
    }
    let name: string | undefined = row.name || undefined;
    if (name && name.length > MAX_NAME) {
      report.notes.push(`${at}: name longer than ${MAX_NAME}, left out`);
      name = undefined;
    }
    // Matched without regard to case, stored as the stage list spells it.
    const stage = row.lead_stage
      ? leadStages.find(s => s.toLowerCase() === row.lead_stage?.toLowerCase())
      : undefined;
    if (row.lead_stage && !stage) {
      report.notes.push(
        `${at}: lead stage "${row.lead_stage}" is not one of ${leadStages.join(', ')}, left out`
      );
    }
    const given = [
      ...new Set(
        (row.tags ?? '')
          .split(/[;|]/)
          .map(v => v.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
    const tags = given.filter(tag => tag.length <= MAX_TAG);
    if (tags.length < given.length) {
      report.notes.push(`${at}: tags longer than ${MAX_TAG} left out`);
    }
    const companyId = await companyFor(store, row, note =>
      report.notes.push(`${at}: ${note}`)
    );

    const known =
      (await store.findContactByIdentity('email', email, {
        verifiedOnly: false,
      })) ?? (await store.findContactByEmail(email));
    if (!known) {
      await store.createContact(
        {
          email,
          name: name ?? null,
          leadStage: stage ?? null,
          companyId: companyId ?? null,
          tags: tags.slice(0, MAX_TAGS),
        },
        { channel: 'email', externalId: email, verified: false }
      );
      report.created++;
      continue;
    }
    const merged = [...new Set([...known.tags, ...tags])].slice(0, MAX_TAGS);
    const patch = {
      ...(!known.email && { email }),
      ...(!known.name && name && { name }),
      ...(!known.leadStage && stage && { leadStage: stage }),
      ...(!known.companyId && companyId && { companyId }),
      ...(merged.length !== known.tags.length && { tags: merged }),
    };
    if (Object.keys(patch).length === 0) {
      report.skipped++;
      continue;
    }
    await store.updateContact(known.id, patch);
    report.updated++;
  }
  return report;
}

async function companyFor(
  store: HelpdeskStore,
  row: Record<string, string>,
  note: (text: string) => void
) {
  let domain = row.domain?.toLowerCase() || undefined;
  let name = row.company || undefined;
  if (domain && domain.length > MAX_NAME) {
    note(`domain longer than ${MAX_NAME}, left out`);
    domain = undefined;
  }
  if (name && name.length > MAX_NAME) {
    note(`company longer than ${MAX_NAME}, left out`);
    name = undefined;
  }
  if (domain) {
    const byDomain = await store.findCompanyByDomain(domain);
    if (byDomain) return byDomain.id;
    // One named alike but still without a domain is the same company.
    const byName = name ? await store.findCompanyByName(name) : null;
    if (byName && !byName.domain) {
      await store.updateCompany(byName.id, { domain });
      return byName.id;
    }
    return (await store.createCompany({ name: name ?? domain, domain })).id;
  }
  if (name) {
    const company =
      (await store.findCompanyByName(name)) ??
      (await store.createCompany({ name }));
    return company.id;
  }
  return undefined;
}

/** Canned replies by `title` and `body`, with an optional `locale`; one with the same title and locale is left alone. */
export async function importCannedReplies(
  store: HelpdeskStore,
  rows: Record<string, string>[]
): Promise<ImportReport> {
  const report: ImportReport = {
    created: 0,
    updated: 0,
    skipped: 0,
    notes: [],
  };
  const existing = new Set(
    (await store.listCannedReplies()).map(r => `${r.title}\n${r.locale ?? ''}`)
  );
  for (const [index, row] of rows.entries()) {
    const locale =
      row.locale === 'en' ||
      row.locale === 'de' ||
      row.locale === 'fr' ||
      row.locale === 'it'
        ? row.locale
        : null;
    if (row.locale && !locale) {
      report.notes.push(
        `row ${index + 2}: locale "${row.locale}" is not en, de, fr or it, saved for any language`
      );
    }
    const key = `${row.title}\n${locale ?? ''}`;
    if (!row.title || !row.body) {
      report.skipped++;
      report.notes.push(`row ${index + 2}: needs a title and a body, skipped`);
      continue;
    }
    if (row.title.length > MAX_NAME || row.body.length > MAX_BODY) {
      report.skipped++;
      report.notes.push(
        `row ${index + 2}: title over ${MAX_NAME} or body over ${MAX_BODY} characters, skipped`
      );
      continue;
    }
    if (existing.has(key)) {
      report.skipped++;
      continue;
    }
    await store.createCannedReply({ title: row.title, body: row.body, locale });
    existing.add(key);
    report.created++;
  }
  return report;
}
