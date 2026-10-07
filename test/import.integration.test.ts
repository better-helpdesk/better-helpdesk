import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { importCannedReplies, importContacts, parseCsv } from '../src/import';
import { createHarness } from './harness';

const h = createHarness();

beforeEach(() => h.reset());
afterAll(() => h.close());

async function contacts() {
  const companies = await h.find('company');
  return Promise.all(
    (await h.find('contact', {}, { orderBy: { email: 'asc' } })).map(
      async c => {
        const company = companies.find(co => co.id === c.companyId);
        return {
          email: c.email,
          name: c.name,
          tags: (await h.support.store.getContact(c.id))?.tags,
          leadStage: c.leadStage,
          company: company?.name ?? null,
          domain: company?.domain ?? null,
        };
      }
    )
  );
}

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
    await h.update(
      'contact',
      { email: 'ada@acme.test' },
      { name: 'Ada Lovelace (CTO)' }
    );
    await h.update(
      'company',
      { domain: 'acme.test' },
      { name: 'Acme Corporation' }
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

    expect(await contacts()).toEqual([
      {
        email: 'ada@acme.test',
        name: 'Ada Lovelace (CTO)',
        tags: ['vip', 'beta', 'churn-risk'],
        leadStage: 'customer',
        company: 'Acme Corporation',
        domain: 'acme.test',
      },
      {
        email: 'bob@acme.test',
        name: 'Bob',
        tags: [],
        leadStage: null,
        company: 'Acme Corporation',
        domain: 'acme.test',
      },
      {
        email: 'cleo@mail.test',
        name: 'Cleo',
        tags: [],
        leadStage: 'lead',
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
    expect((await contacts()).map(r => [r.email, r.company])).toEqual([
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
    expect(await contacts()).toMatchObject([
      { email: 'ada@acme.test', name: null, tags: ['ok'], leadStage: null },
    ]);
  });

  it('matches a lead stage without regard to case and stores the configured spelling', async () => {
    const report = await importContacts(
      h.support.store,
      parseCsv('email,lead_stage\nt@a.test,trial\nu@a.test,Churned\n'),
      { leadStages: ['Lead', 'Trial'] }
    );
    expect(report.notes).toEqual([
      'row 3: lead stage "Churned" is not one of Lead, Trial, left out',
    ]);
    expect(
      (await h.find('contact', {}, { orderBy: { email: 'asc' } })).map(r => ({
        email: r.email,
        leadStage: r.leadStage,
      }))
    ).toEqual([
      { email: 't@a.test', leadStage: 'Trial' },
      { email: 'u@a.test', leadStage: null },
    ]);
  });

  it('gives a company that an earlier row named its domain instead of making a second one', async () => {
    await importContacts(
      h.support.store,
      parseCsv(
        'email,company,domain\nann@gmail.test,Alpha,\nbob@alpha.test,Alpha,alpha.test\n'
      )
    );
    expect(
      (await h.find('company')).map(r => ({ name: r.name, domain: r.domain }))
    ).toEqual([{ name: 'Alpha', domain: 'alpha.test' }]);
  });

  it('leaves out a company name or domain longer than the agent UI takes', async () => {
    const report = await importContacts(
      h.support.store,
      parseCsv(
        `email,company,domain\nann@a.test,${'c'.repeat(201)},${'d'.repeat(201)}.test\n`
      )
    );
    expect(report.notes).toEqual([
      'row 2: domain longer than 200, left out',
      'row 2: company longer than 200, left out',
    ]);
    expect(await h.count('company')).toBe(0);
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
      (await h.find('contact')).map(r => ({
        email: r.email,
        name: r.name,
        leadStage: r.leadStage,
      }))
    ).toEqual([{ email: 'ada@acme.test', name: 'ada', leadStage: 'customer' }]);
  });
});

describe('importCannedReplies', () => {
  it('skips a saved reply the agent UI could not save', async () => {
    const report = await importCannedReplies(
      h.support.store,
      parseCsv(
        `title,body\n${'t'.repeat(201)},Body\nOk,${'b'.repeat(20_001)}\n`
      )
    );
    expect(report).toMatchObject({ created: 0, skipped: 2 });
    expect(await h.count('canned_reply')).toBe(0);
  });

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
      (await h.find('canned_reply', {}, { orderBy: { locale: 'asc' } })).map(
        r => ({ title: r.title, locale: r.locale, body: r.body })
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
