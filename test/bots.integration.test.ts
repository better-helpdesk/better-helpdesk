import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createHarness } from './harness';

const lead = {
  inbox: 'sales',
  type: 'lead',
  body: 'Pricing for 40 seats',
  email: 'visitor@example.test',
};

describe('the invisible form check', () => {
  const h = createHarness({ botProtection: {} });
  beforeEach(() => h.reset());
  afterEach(() => vi.useRealTimers());
  afterAll(() => h.close());
  const post = (body: unknown, user?: string) =>
    h.call('POST', 'widget/conversations', { body, user });

  it('takes a visitor’s first message only with a signed token from a form open long enough', async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
    const missing = await post(lead);
    expect([missing.status, missing.data.error]).toEqual([
      400,
      'Form check failed',
    ]);

    const form = await h.call('GET', 'widget/form');
    expect(form.data.minSeconds).toBe(3);
    const token: string = form.data.token;
    expect((await post({ ...lead, formToken: token })).status).toBe(400);

    vi.setSystemTime(Date.now() + 3_500);
    const forged = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    expect((await post({ ...lead, formToken: forged })).status).toBe(400);
    const sooner = `${Number(token.split('.')[0]) - 60_000}.${token.split('.')[1]}`;
    expect((await post({ ...lead, formToken: sooner })).status).toBe(400);

    const sent = await post({ ...lead, formToken: token });
    expect(sent.status).toBe(201);
    expect(sent.data.conversation.reference).toMatch(/^DG-/);

    vi.setSystemTime(Date.now() + 86_400_000);
    expect((await post({ ...lead, formToken: token })).status).toBe(400);
    expect(await h.count('conversation')).toBe(1);
  });

  it('leaves signed-in customers to the host’s sign-in', async () => {
    h.addUser('ada');
    const sent = await post(
      { inbox: 'support', type: 'question', body: 'Where is the export?' },
      'ada'
    );
    expect(sent.status).toBe(201);
  });

  it('drops a message whose hidden field was filled, as if it went through', async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
    const { token } = (await h.call('GET', 'widget/form')).data;
    vi.setSystemTime(Date.now() + 5_000);
    const sent = await post({
      ...lead,
      formToken: token,
      website: 'https://spam.test',
    });
    expect([sent.status, sent.data.conversation]).toEqual([201, null]);
    expect(await h.count('conversation')).toBe(0);
  });
});

describe('a captcha', () => {
  const checked: [string, unknown][] = [];
  const client = {
    script: 'https://captcha.test/api.js',
    global: 'testCaptcha',
    siteKey: 'site-key',
  };
  const captcha = {
    client,
    async verify(token: string, context: { ip: string | null }) {
      checked.push([token, context]);
      return token === 'solved';
    },
  };
  const h = createHarness({ captcha });
  const everyone = createHarness({ captcha: { ...captcha, for: 'everyone' } });
  beforeEach(async () => {
    checked.length = 0;
    await h.reset();
    await everyone.reset();
  });
  afterAll(async () => {
    await h.close();
    await everyone.close();
  });

  it('asks visitors to solve it and checks their answer with the provider', async () => {
    const session = await h.call('GET', 'widget/session?inbox=sales');
    expect(session.data.captcha).toEqual(client);
    const post = (captchaToken?: string) =>
      h.call('POST', 'widget/conversations', {
        body: { ...lead, captchaToken },
        headers: { 'x-forwarded-for': '203.0.113.7' },
      });

    expect((await post()).data.error).toBe('Captcha required');
    expect((await post('guessed')).data.error).toBe('Captcha failed');
    expect((await post('solved')).status).toBe(201);
    expect(checked).toEqual([
      ['guessed', { ip: '203.0.113.7' }],
      ['solved', { ip: '203.0.113.7' }],
    ]);
    expect(await h.count('conversation')).toBe(1);
  });

  it('spares signed-in customers unless it is for everyone', async () => {
    h.addUser('ada');
    everyone.addUser('ada');
    const ask = { inbox: 'support', type: 'question', body: 'Export?' };

    expect(
      (await h.call('GET', 'widget/session?inbox=support', { user: 'ada' }))
        .data.captcha
    ).toBeNull();
    expect(
      (await h.call('POST', 'widget/conversations', { body: ask, user: 'ada' }))
        .status
    ).toBe(201);

    expect(
      (
        await everyone.call('GET', 'widget/session?inbox=support', {
          user: 'ada',
        })
      ).data.captcha
    ).toEqual(client);
    expect(
      (
        await everyone.call('POST', 'widget/conversations', {
          body: ask,
          user: 'ada',
        })
      ).data.error
    ).toBe('Captcha required');
    expect(checked).toEqual([]);
  });
});
