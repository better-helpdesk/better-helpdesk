import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { importCannedReplies, importContacts, parseCsv } from '../src/import';
import { createHarness } from './harness';

const h = createHarness();

beforeEach(() => h.reset());
afterAll(() => h.close());

async function rows<T>(query: ReturnType<typeof sql>) {
  return (await h.support.store.db.execute(query)).rows as T[];
}

const contactsCsv = `email,name,company,domain,tags,lead_stage
ada@acme.test,Ada,Acme,,vip;beta,customer
BOB@acme.test,Bob,,,,
cleo@mail.test,Cleo,Cleo Ltd,cleo.test,,lead
not-an-email,Nobody,,,,
`;

describe('importContacts', () => {
  it('creates contacts and companies once, and updates them when run again', async () => {
    const store = h.support.store;
    expect(await importContacts(store, parseCsv(contactsCsv))).toEqual({
      created: 3,
      updated: 0,
      skipped: 1,
    });
    expect(
      await importContacts(
        store,
        parseCsv('email,name,tags\nada@acme.test,Ada Lovelace,churn-risk\n')
      )
    ).toEqual({ created: 0, updated: 1, skipped: 0 });

    expect(
      await rows(sql`
        SELECT c.email, c.name, c.tags, c.lead_stage, co.name AS company, co.domain
        FROM helpdesk.contact c LEFT JOIN helpdesk.company co ON co.id = c.company_id
        ORDER BY c.email`)
    ).toEqual([
      {
        email: 'ada@acme.test',
        name: 'Ada Lovelace',
        tags: ['vip', 'beta', 'churn-risk'],
        lead_stage: 'customer',
        company: 'Acme',
        domain: 'acme.test',
      },
      {
        email: 'bob@acme.test',
        name: 'Bob',
        tags: [],
        lead_stage: null,
        company: null,
        domain: null,
      },
      {
        email: 'cleo@mail.test',
        name: 'Cleo',
        tags: [],
        lead_stage: 'lead',
        company: 'Cleo Ltd',
        domain: 'cleo.test',
      },
    ]);
  });

  it('updates a contact the host already identified instead of adding a second one', async () => {
    h.addUser('ada', { email: 'ada@acme.test' });
    await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: { inbox: 'support', type: 'question', body: 'Hello' },
    });
    await importContacts(
      h.support.store,
      parseCsv('email,lead_stage\nada@acme.test,customer\n')
    );
    expect(
      await rows(sql`SELECT email, lead_stage FROM helpdesk.contact`)
    ).toEqual([{ email: 'ada@acme.test', lead_stage: 'customer' }]);
  });
});

describe('importCannedReplies', () => {
  it('adds each title and locale once', async () => {
    const csv = `title,body,locale
Refund,"We have refunded you, **today**.",en
Refund,Wir haben Ihnen den Betrag zurückerstattet.,de
Empty,,en
`;
    expect(await importCannedReplies(h.support.store, parseCsv(csv))).toEqual({
      created: 2,
      updated: 0,
      skipped: 1,
    });
    expect(await importCannedReplies(h.support.store, parseCsv(csv))).toEqual({
      created: 0,
      updated: 0,
      skipped: 3,
    });
    expect(
      await rows(
        sql`SELECT title, locale, body FROM helpdesk.canned_reply ORDER BY locale`
      )
    ).toEqual([
      {
        title: 'Refund',
        locale: 'de',
        body: 'Wir haben Ihnen den Betrag zurückerstattet.',
      },
      {
        title: 'Refund',
        locale: 'en',
        body: 'We have refunded you, **today**.',
      },
    ]);
  });
});
