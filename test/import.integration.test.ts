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

const contacts = () => sql`
  SELECT c.email, c.name, c.tags, c.lead_stage, co.name AS company, co.domain
  FROM helpdesk.contact c LEFT JOIN helpdesk.company co ON co.id = c.company_id
  ORDER BY c.email`;

describe('importContacts', () => {
  it('creates contacts with their companies, and on a rerun only adds what is missing', async () => {
    const store = h.support.store;
    const csv = `email,name,company,domain,tags,lead_stage
ada@acme.test,Ada,Acme,acme.test,vip;beta,Customer
bob@acme.test,Bob,,acme.test,,
cleo@mail.test,Cleo,Cleo Ltd,,,lead
not-an-email,Nobody,,,,
`;
    expect(await importContacts(store, parseCsv(csv))).toMatchObject({
      created: 3,
      updated: 0,
      skipped: 1,
    });
    // An agent edits Ada and renames her company before the rerun.
    await store.db.execute(
      sql`UPDATE helpdesk.contact SET name = 'Ada Lovelace (CTO)' WHERE email = 'ada@acme.test'`
    );
    await store.db.execute(
      sql`UPDATE helpdesk.company SET name = 'Acme Corporation' WHERE domain = 'acme.test'`
    );
    const rerun = `email,name,company,domain,tags,lead_stage
ada@acme.test,Ada,Acme,acme.test,churn-risk,lead
bob@acme.test,Bob,,acme.test,,
`;
    expect(await importContacts(store, parseCsv(rerun))).toMatchObject({
      created: 0,
      updated: 1,
      skipped: 1,
    });

    expect(await rows(contacts())).toEqual([
      {
        email: 'ada@acme.test',
        name: 'Ada Lovelace (CTO)',
        tags: ['vip', 'beta', 'churn-risk'],
        lead_stage: 'customer',
        company: 'Acme Corporation',
        domain: 'acme.test',
      },
      {
        email: 'bob@acme.test',
        name: 'Bob',
        tags: [],
        lead_stage: null,
        company: 'Acme Corporation',
        domain: 'acme.test',
      },
      {
        email: 'cleo@mail.test',
        name: 'Cleo',
        tags: [],
        lead_stage: 'lead',
        company: 'Cleo Ltd',
        domain: null,
      },
    ]);
  });

  it('keeps companies apart whose people share a mail provider', async () => {
    await importContacts(
      h.support.store,
      parseCsv(`email,company
ann@gmail.test,Alpha GmbH
ben@gmail.test,Beta AG
carl@gmail.test,alpha gmbh
`)
    );
    expect(
      (await rows<{ email: string; company: string }>(contacts())).map(r => [
        r.email,
        r.company,
      ])
    ).toEqual([
      ['ann@gmail.test', 'Alpha GmbH'],
      ['ben@gmail.test', 'Beta AG'],
      ['carl@gmail.test', 'Alpha GmbH'],
    ]);
  });

  it('leaves out a lead stage, tag or name the agent UI would refuse, and says so', async () => {
    const report = await importContacts(
      h.support.store,
      parseCsv(`email,name,tags,lead_stage
ada@acme.test,${'x'.repeat(201)},ok;${'t'.repeat(51)},prospect
`),
      { leadStages: ['lead', 'customer'] }
    );
    expect(report.created).toBe(1);
    expect(report.notes).toEqual([
      'row 2: name longer than 200, left out',
      'row 2: lead stage "prospect" is not one of lead, customer, left out',
      'row 2: tags longer than 50 left out',
    ]);
    expect(await rows(contacts())).toMatchObject([
      { email: 'ada@acme.test', name: null, tags: ['ok'], lead_stage: null },
    ]);
  });

  it('fills in a contact the host already identified instead of adding a second one', async () => {
    h.addUser('ada', { email: 'ada@acme.test' });
    await h.call('POST', 'widget/conversations', {
      user: 'ada',
      body: { inbox: 'support', type: 'question', body: 'Hello' },
    });
    await importContacts(
      h.support.store,
      parseCsv('email,name,lead_stage\nada@acme.test,Someone else,customer\n')
    );
    expect(
      await rows(sql`SELECT email, name, lead_stage FROM helpdesk.contact`)
    ).toEqual([
      { email: 'ada@acme.test', name: 'ada', lead_stage: 'customer' },
    ]);
  });
});

describe('importCannedReplies', () => {
  it('adds each title and locale once', async () => {
    const csv = `title,body,locale
Refund,"We have refunded you, **today**.",en
Refund,Wir haben Ihnen den Betrag zurückerstattet.,de
Empty,,en
`;
    expect(
      await importCannedReplies(h.support.store, parseCsv(csv))
    ).toMatchObject({ created: 2, skipped: 1 });
    expect(
      await importCannedReplies(h.support.store, parseCsv(csv))
    ).toMatchObject({ created: 0, skipped: 3 });
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
