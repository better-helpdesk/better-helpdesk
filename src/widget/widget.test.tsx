// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { widgetCss } from './styles';
import { Widget } from './widget';

// jsdom has no layout, so nothing can scroll.
Element.prototype.scrollIntoView = () => {};

type Call = { url: string; method: string; body: unknown };

function mockApi(routes: Record<string, unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      const key = Object.keys(routes)
        .filter(k => url.includes(k))
        .sort((a, b) => b.length - a.length)[0];
      return new Response(JSON.stringify(key ? routes[key] : {}), {
        status: 200,
      });
    })
  );
  return calls;
}

const session = {
  identified: true,
  name: 'Ada',
  email: 'ada@example.test',
  orgs: [{ id: 'org-a', name: 'Org A' }],
  types: ['question', 'bug', 'feature', 'lead'],
  help: false,
  uploads: true,
  team: [{ name: 'Angelo', initials: 'AD' }],
  inbox: null,
  conversations: [],
};

// Posting answers with the new conversation; the widget then opens and polls it.
const posted = {
  'widget/conversations/': {
    conversation: { id: 'c1', reference: 'DG-1000' },
  },
  'widget/conversations/c1/': {
    conversation: {
      id: 'c1',
      reference: 'DG-1000',
      subject: null,
      type: 'bug',
      status: 'open',
    },
    messages: [
      {
        id: 'm1',
        author: 'contact',
        name: 'Ada',
        own: true,
        body: 'Broken',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    attachments: [],
  },
};

const ownThread = {
  id: 'c1',
  reference: 'DG-1',
  subject: 'Export broken',
  type: 'bug',
  status: 'open',
  inbox: 'support',
  own: true,
  unread: false,
  sharedWithCompany: false,
  lastMessageAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  preview: null,
  lastFromSupport: true,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Widget', () => {
  it('sends a bug report with the context the user kept', async () => {
    const calls = mockApi({
      'widget/session': session,
      ...posted,
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        types={['question', 'bug', 'feature']}
        hostContext={{ control: 'A.5.1' }}
        orgId="org-a"
        errors={() => ['TypeError: x is undefined']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Report a bug/ })
    );
    fireEvent.change(screen.getByLabelText('Subject (optional)'), {
      target: { value: 'Export broken' },
    });
    const message = screen.getByRole('textbox', { name: 'What happened?' });
    message.innerHTML = 'It <b>fails</b>';
    fireEvent.input(message);
    fireEvent.click(screen.getByText(/details about this page/));
    fireEvent.click(screen.getByRole('checkbox', { name: /Browser/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() =>
      expect(
        calls.some(
          c => c.method === 'POST' && c.url.endsWith('widget/conversations/')
        )
      ).toBe(true)
    );
    // The widget opens the new thread and loads it; let that land inside the test.
    await screen.findByText('Thank you for reporting this');
    const post = calls.find(
      c => c.method === 'POST' && c.url.endsWith('widget/conversations/')
    );
    if (!post) throw new Error('no conversation was posted');
    expect(post.body).toMatchObject({
      inbox: 'support',
      type: 'bug',
      subject: 'Export broken',
      body: 'It **fails**',
      orgId: 'org-a',
      context: {
        host: { control: 'A.5.1' },
        errors: ['TypeError: x is undefined'],
      },
    });
    expect(
      (post.body as { context: Record<string, unknown> }).context.userAgent
    ).toBeUndefined();
  });

  it('keeps the formatting toolbar behind one toggle on the bug form', async () => {
    mockApi({ 'widget/session': session });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        types={['question', 'bug', 'feature']}
        errors={() => []}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Report a bug/ })
    );
    expect(screen.queryByRole('toolbar', { name: 'Formatting' })).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Formatting' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeTruthy();
  });

  it('sends a pasted three-line trace as a code block', async () => {
    const calls = mockApi({
      'widget/session': session,
      ...posted,
    });
    // jsdom has no editing commands; this one only appends, as at the end.
    document.execCommand = (command: string, _?: boolean, html?: string) => {
      if (command !== 'insertHTML' || !html) return false;
      screen
        .getByRole('textbox', { name: 'What happened?' })
        .insertAdjacentHTML('beforeend', html);
      return true;
    };
    onTestFinished(() => {
      Reflect.deleteProperty(document, 'execCommand');
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        types={['question', 'bug']}
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Report a bug/ })
    );
    const message = screen.getByRole('textbox', { name: 'What happened?' });
    const trace =
      'TypeError: <b>x</b> is undefined\n    at render (app.js:10:5)\n    at main (app.js:2:1)';
    fireEvent.paste(message, {
      clipboardData: {
        items: [],
        getData: (type: string) => (type === 'text/plain' ? trace : ''),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() =>
      expect(
        calls.find(
          c => c.method === 'POST' && c.url.endsWith('widget/conversations/')
        )?.body
      ).toMatchObject({ body: `\`\`\`\n${trace}\n\`\`\`` })
    );
    // The widget opens the new thread and loads it; let that land inside the test.
    await screen.findByText('Thank you for reporting this');
  });

  it('keeps the formatting of a rich paste whose text is indented', async () => {
    const calls = mockApi({
      'widget/session': session,
      ...posted,
    });
    // jsdom has no editing commands; this one only appends, as at the end.
    document.execCommand = (command: string, _?: boolean, html?: string) => {
      if (command !== 'insertHTML' || !html) return false;
      screen
        .getByRole('textbox', { name: 'What happened?' })
        .insertAdjacentHTML('beforeend', html);
      return true;
    };
    onTestFinished(() => {
      Reflect.deleteProperty(document, 'execCommand');
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        types={['question', 'bug']}
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Report a bug/ })
    );
    const message = screen.getByRole('textbox', { name: 'What happened?' });
    const trace = 'Plan:\n    ◦ export\n    ◦ import';
    const html = '<p><b>Plan:</b></p><ul><li>export</li><li>import</li></ul>';
    fireEvent.paste(message, {
      clipboardData: {
        items: [],
        getData: (type: string) => (type === 'text/plain' ? trace : html),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() =>
      expect(
        calls.find(
          c => c.method === 'POST' && c.url.endsWith('widget/conversations/')
        )?.body
      ).toMatchObject({ body: '**Plan:**\n\n- export\n- import' })
    );
    // The widget opens the new thread and loads it; let that land inside the test.
    await screen.findByText('Thank you for reporting this');
  });

  it('shows each captured page error and sends only the ones left ticked', async () => {
    const calls = mockApi({
      'widget/session': session,
      ...posted,
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        types={['bug']}
        errors={() => ['TypeError: private token abc', 'ReferenceError: y']}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    const message = await screen.findByRole('textbox', {
      name: 'What happened?',
    });
    message.innerHTML = 'Broken';
    fireEvent.input(message);
    fireEvent.click(screen.getByText(/details about this page/));
    fireEvent.click(
      screen.getByRole('checkbox', { name: /TypeError: private token abc/ })
    );
    expect(
      screen.getByRole('checkbox', { name: /ReferenceError: y/ })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() =>
      expect(
        calls.some(
          c => c.method === 'POST' && c.url.endsWith('widget/conversations/')
        )
      ).toBe(true)
    );
    // The widget opens the new thread and loads it; let that land inside the test.
    await screen.findByText('Thank you for reporting this');
    const post = calls.find(
      c => c.method === 'POST' && c.url.endsWith('widget/conversations/')
    );
    if (!post) throw new Error('no conversation was posted');
    expect(
      (post.body as { context: { errors?: string[] } }).context.errors
    ).toEqual(['ReferenceError: y']);
  });

  it('shows "Seen" under the customer’s last message once an agent has opened it, and only then', async () => {
    const sent = '2026-01-01T10:00:00.000Z';
    const thread = (agentSeenAt: string | null) => ({
      'widget/session': { ...session, conversations: [ownThread] },
      'widget/conversations/c1/': {
        conversation: {
          id: 'c1',
          reference: 'DG-1',
          subject: 'Export broken',
          type: 'bug',
          status: 'open',
          agentSeenAt,
        },
        messages: [
          {
            id: 'm1',
            author: 'agent',
            name: 'Angelo',
            own: false,
            body: 'Which browser?',
            createdAt: '2026-01-01T09:00:00.000Z',
          },
          {
            id: 'm2',
            author: 'contact',
            name: 'Ada',
            own: true,
            body: 'Firefox',
            createdAt: sent,
          },
        ],
        attachments: [],
      },
    });
    const open = async () => {
      render(
        <Widget
          api="/api/support"
          inbox="support"
          locale="en"
          errors={() => []}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
      fireEvent.click(await screen.findByRole('tab', { name: /Messages/ }));
      fireEvent.click(await screen.findByText('Export broken'));
      await screen.findByText('Firefox');
    };

    mockApi(thread('2026-01-01T09:30:00.000Z'));
    await open();
    expect(screen.queryByText('Seen')).toBeNull();
    cleanup();

    mockApi(thread(sent));
    await open();
    expect(await screen.findByText('Seen')).toBeTruthy();
  });

  it('opens inline on the customer’s conversations, with no launcher and nothing to close', async () => {
    mockApi({
      'widget/session': { ...session, conversations: [ownThread] },
      ...posted,
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
        inline
      />
    );
    const page = await screen.findByRole('region');
    expect(await within(page).findByText('Export broken')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open support' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close support' })).toBeNull();
    expect(document.activeElement).toBe(document.body);

    fireEvent.click(within(page).getByText('Export broken'));
    await within(page).findByText('Broken');
    fireEvent.click(within(page).getByRole('button', { name: 'Back' }));
    expect(await within(page).findByText('Export broken')).toBeTruthy();
  });

  it('shows where a labelled link goes in a colleague’s message, not in one’s own', async () => {
    mockApi({
      'widget/session': {
        ...session,
        conversations: [
          {
            id: 'c1',
            reference: 'DG-1',
            subject: 'Shared thread',
            type: 'question',
            status: 'open',
            inbox: 'support',
            own: false,
            unread: false,
            sharedWithCompany: true,
            lastMessageAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            preview: null,
            lastFromSupport: false,
          },
        ],
      },
      'widget/conversations/c1/': {
        conversation: {
          id: 'c1',
          reference: 'DG-1',
          subject: 'Shared thread',
          type: 'question',
          status: 'open',
        },
        messages: [
          {
            id: 'm1',
            author: 'contact',
            name: 'Bob',
            own: false,
            body: '[Audit report](https://evil.example/r)',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'm2',
            author: 'contact',
            name: 'Ada',
            own: true,
            body: '[My notes](https://docs.example/n)',
            createdAt: new Date().toISOString(),
          },
        ],
        attachments: [],
      },
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    fireEvent.click(await screen.findByRole('tab', { name: /Messages/ }));
    fireEvent.click(await screen.findByText('Shared thread'));
    expect(
      (await screen.findByText('Audit report')).parentElement?.textContent
    ).toContain('(evil.example)');
    expect(
      screen.getByText('My notes').parentElement?.textContent
    ).not.toContain('docs.example');
  });

  it('shows a code block in a reply with a button to copy it', async () => {
    mockApi({
      'widget/session': { ...session, conversations: [ownThread] },
      'widget/conversations/c1/': {
        conversation: {
          id: 'c1',
          reference: 'DG-1',
          subject: 'Export broken',
          type: 'bug',
          status: 'open',
        },
        messages: [
          {
            id: 'm1',
            author: 'agent',
            name: 'Angelo',
            own: false,
            body: 'Run this:\n```\nnpm run export -- --since <date>\n```',
            createdAt: new Date().toISOString(),
          },
        ],
        attachments: [],
      },
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="de"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Support/ }));
    fireEvent.click(await screen.findByRole('tab', { name: /Nachrichten/ }));
    fireEvent.click(await screen.findByText('Export broken'));
    const copy = await screen.findByRole('button', { name: 'Code kopieren' });
    expect(copy.closest('.code')?.querySelector('pre')?.textContent).toBe(
      'npm run export -- --since <date>'
    );
  });

  it('says so when the session fails to load, and recovers on retry', async () => {
    let up = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        up
          ? new Response(JSON.stringify(session))
          : new Response(JSON.stringify({ error: 'Internal error' }), {
              status: 500,
            })
      )
    );
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'This could not be loaded.'
    );

    up = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('button', { name: /Report a bug/ })
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cancels a link with Escape without closing the panel or losing the draft', async () => {
    mockApi({ 'widget/session': session });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        types={['question', 'bug', 'feature']}
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Report a bug/ })
    );
    fireEvent.change(screen.getByLabelText('Subject (optional)'), {
      target: { value: 'Export broken' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Formatting' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'What happened?' }), {
      key: 'k',
      metaKey: true,
    });

    fireEvent.keyDown(
      await screen.findByRole('textbox', { name: 'Link address' }),
      {
        key: 'Escape',
      }
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      (screen.getByLabelText('Subject (optional)') as HTMLInputElement).value
    ).toBe('Export broken');
  });

  it('retries only the failed upload, never the conversation', async () => {
    const calls: Call[] = [];
    let failUpload = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, method: init?.method ?? 'GET', body: undefined });
        if (url.includes('widget/session')) {
          return new Response(JSON.stringify(session));
        }
        if (url.endsWith('widget/conversations/')) {
          return new Response(
            JSON.stringify({ conversation: { id: 'c1', reference: 'DG-1' } })
          );
        }
        if (url.endsWith('widget/conversations/c1/')) {
          return new Response(
            JSON.stringify({
              conversation: {
                id: 'c1',
                reference: 'DG-1',
                subject: null,
                type: 'bug',
                status: 'open',
              },
              messages: [],
              attachments: [],
            })
          );
        }
        if (url.endsWith('/attachments/')) {
          if (failUpload) {
            failUpload = false;
            return new Response('{}', { status: 500 });
          }
          return new Response(
            JSON.stringify({
              id: 'f1',
              upload: { url: 'https://s3.test', fields: {} },
            })
          );
        }
        return new Response('{}');
      })
    );
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        types={['question', 'bug', 'feature']}
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Report a bug/ })
    );
    const message = screen.getByRole('textbox', { name: 'What happened?' });
    message.innerHTML = 'Export fails';
    fireEvent.input(message);
    fireEvent.change(screen.getByLabelText(/Attach/), {
      target: {
        files: [new File(['x'], 'log.txt', { type: 'text/plain' })],
      },
    });
    const send = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    const conversationPosts = () =>
      calls.filter(
        c => c.method === 'POST' && c.url.endsWith('widget/conversations/')
      );

    send();
    await waitFor(() =>
      expect(calls.some(c => c.url.endsWith('/attachments/'))).toBe(true)
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Send message' })
          .hasAttribute('disabled')
      ).toBe(false)
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Your message was sent, but the attachments could not be uploaded. Please try again.'
    );
    expect(message.getAttribute('contenteditable')).toBe('false');
    send();

    await waitFor(() =>
      expect(calls.some(c => c.url.includes('/attachments/f1/complete'))).toBe(
        true
      )
    );
    expect(conversationPosts()).toHaveLength(1);
  });

  it('opens a single-type widget with the message field focused', async () => {
    mockApi({
      'widget/session': { ...session, identified: false, orgs: [] },
    });
    render(
      <Widget
        api="/api/support"
        inbox="sales"
        locale="en"
        types={['lead']}
        errors={() => []}
      />
    );
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));

    const message = await screen.findByRole('textbox', {
      name: 'What can we help you with?',
    });
    await waitFor(() => expect(document.activeElement).toBe(message));
  });

  it('asks an anonymous visitor for an email and offers only the configured types', async () => {
    mockApi({
      'widget/session': { ...session, identified: false, orgs: [] },
    });
    render(
      <Widget
        api="/api/support"
        inbox="sales"
        locale="de"
        types={['lead']}
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Support öffnen' }));
    expect(
      await screen.findByLabelText('Geschäftliche E-Mail-Adresse')
    ).toBeTruthy();
    expect(screen.getByText('Mit uns sprechen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Fehler melden/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zurück' })).toBeNull();
  });

  it('keeps one visitor per API, so a second helpdesk on the page cannot replace it', async () => {
    // Node's own localStorage shadows jsdom's and needs a file to exist.
    vi.stubGlobal('localStorage', sessionStorage);
    onTestFinished(() => sessionStorage.clear());
    localStorage.setItem('helpdesk-visitor', 'v'.repeat(43));
    const fetch = vi.fn(async (url: string, init?: RequestInit) =>
      Response.json(
        url.includes('widget/session')
          ? { ...session, identified: false, orgs: [] }
          : init?.method === 'POST'
            ? {
                conversation: { id: 'c1', reference: 'DG-1000' },
                visitorToken: 'n'.repeat(43),
              }
            : { conversation: ownThread, messages: [] },
        { status: init?.method === 'POST' ? 201 : 200 }
      )
    );
    vi.stubGlobal('fetch', fetch);
    render(
      <Widget
        api="/demo/api/"
        inbox="sales"
        locale="en"
        types={['lead']}
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    fireEvent.change(await screen.findByLabelText('Work email'), {
      target: { value: 'ada@example.test' },
    });
    const message = screen.getByRole('textbox', {
      name: 'What can we help you with?',
    });
    message.innerHTML = 'Pricing?';
    fireEvent.input(message);
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() =>
      expect(localStorage.getItem('helpdesk-visitor:/demo/api')).toBe(
        'n'.repeat(43)
      )
    );
    expect(localStorage.getItem('helpdesk-visitor')).toBe('v'.repeat(43));
    const [, first] = fetch.mock.calls[0] ?? [];
    expect(new Headers(first?.headers).get('x-helpdesk-visitor')).toBe(
      'v'.repeat(43)
    );
  });

  it('names the one person who answers, and the team once there are more', async () => {
    mockApi({ 'widget/session': session });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    expect(
      await screen.findByText(/^Angelo answers you personally/)
    ).toBeTruthy();
    cleanup();

    mockApi({
      'widget/session': {
        ...session,
        team: [
          { name: 'Angelo', initials: 'AD' },
          { name: 'Mia', initials: 'MB' },
        ],
        teamName: 'The devguard team',
      },
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    expect(
      await screen.findByText(/^The devguard team answers you personally/)
    ).toBeTruthy();
  });

  it('loads the session in its own locale', async () => {
    const twoAgents = [
      { name: 'Angelo', initials: 'AD' },
      { name: 'Mia', initials: 'MB' },
    ];
    mockApi({
      'widget/session': { ...session, team: twoAgents, teamName: 'The team' },
      'widget/session/?inbox=support&locale=de': {
        ...session,
        team: twoAgents,
        teamName: 'Das Team',
      },
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="de"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Support öffnen' }));
    expect(
      await screen.findByText(/^Das Team antwortet Ihnen persönlich/)
    ).toBeTruthy();
  });

  it.each([
    [true, 2],
    [false, 0],
  ])(
    'with uploads %s, a bug report offers %i upload controls',
    async (uploads, count) => {
      mockApi({ 'widget/session': { ...session, uploads } });
      render(
        <Widget
          api="/api/support"
          inbox="support"
          locale="en"
          types={['bug']}
          errors={() => []}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
      await screen.findByRole('textbox', { name: 'What happened?' });
      expect(
        screen.queryAllByText(/^(Capture screenshot|Attach file)$/)
      ).toHaveLength(count);
    }
  );

  it('says when the team is back while everyone is away', async () => {
    mockApi({
      'widget/session': { ...session, awayUntil: '2026-10-02T21:59:59.000Z' },
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    expect(
      await screen.findByText(/^Angelo is away until .+ You will hear back by/)
    ).toBeTruthy();
  });

  it('says when a closed inbox opens again, in the visitor’s time zone', async () => {
    const zone = process.env.TZ;
    process.env.TZ = 'Europe/Zurich';
    // Saturday 24 October; the clocks go back overnight.
    vi.useFakeTimers({
      now: new Date('2026-10-24T12:00:00Z'),
      toFake: ['Date'],
    });
    onTestFinished(() => {
      process.env.TZ = zone;
      vi.useRealTimers();
    });
    mockApi({
      'widget/session': {
        ...session,
        awayUntil: '2026-10-26T07:00:00.000Z',
        nextOpening: '2026-10-26T07:00:00.000Z',
      },
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    expect(
      await screen.findByText(
        'Angelo is back on Monday at 08:00 CET and replies to your message then.'
      )
    ).toBeTruthy();
  });

  it('dates an opening more than a few days off', async () => {
    const zone = process.env.TZ;
    process.env.TZ = 'Europe/Zurich';
    vi.useFakeTimers({
      now: new Date('2026-10-24T12:00:00Z'),
      toFake: ['Date'],
    });
    onTestFinished(() => {
      process.env.TZ = zone;
      vi.useRealTimers();
    });
    mockApi({
      'widget/session': {
        ...session,
        team: [],
        awayUntil: '2026-11-02T22:59:59.000Z',
        nextOpening: '2026-11-03T07:00:00.000Z',
      },
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="de"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /support/i }));
    expect(
      await screen.findByText(
        'Wir sind am Dienstag, 3. November um 08:00 MEZ wieder da und antworten Ihnen dann.'
      )
    ).toBeTruthy();
  });

  it('lets the author mark a thread resolved and says so when that fails', async () => {
    const summary = ownThread;
    let status = 'open';
    let failPatch = true;
    const patches: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('widget/session')) {
          return new Response(
            JSON.stringify({
              ...session,
              conversations: [{ ...summary, status }],
            })
          );
        }
        if (url.endsWith('widget/conversations/c1/')) {
          if (init?.method === 'PATCH') {
            patches.push(JSON.parse(String(init.body)));
            if (failPatch) {
              return new Response(JSON.stringify({ error: 'down' }), {
                status: 500,
              });
            }
            status = 'resolved';
            return new Response(JSON.stringify({ ok: true }));
          }
          return new Response(
            JSON.stringify({
              conversation: { ...summary, status },
              messages: [
                {
                  id: 'm1',
                  author: 'agent',
                  name: 'Angelo',
                  own: false,
                  body: 'Fixed on our side.',
                  createdAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              attachments: [],
            })
          );
        }
        return new Response(JSON.stringify({ ok: true }));
      })
    );
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    fireEvent.click(await screen.findByRole('tab', { name: /Messages/ }));
    fireEvent.click(await screen.findByText('Export broken'));
    await screen.findByText('With our team');

    fireEvent.click(screen.getByRole('button', { name: 'Mark as resolved' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not mark this resolved. Try again.'
    );
    expect(screen.getByText('With our team')).toBeTruthy();

    failPatch = false;
    fireEvent.click(screen.getByRole('button', { name: 'Mark as resolved' }));
    await screen.findByText('Resolved');
    expect(screen.queryByRole('button', { name: 'Mark as resolved' })).toBe(
      null
    );
    expect(screen.queryByRole('alert')).toBe(null);
    expect(patches).toEqual([{ status: 'resolved' }, { status: 'resolved' }]);
    expect(screen.getByRole('status').textContent).toBe('Resolved');
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Write a reply…' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    const card = (await screen.findByText('Export broken')).closest('button');
    expect(card?.textContent).toContain('Resolved');
  });

  it('offers to try again when the widget fails to load, and loads it on retry', async () => {
    let down = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        down
          ? new Response('{}', { status: 500 })
          : new Response(
              JSON.stringify(
                String(input).includes('widget/session') ? session : {}
              )
            )
      )
    );
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('This could not be loaded.');
    down = false;
    fireEvent.click(within(notice).getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('button', { name: /Report a bug/ })
    ).toBeTruthy();
    expect(screen.queryByText('This could not be loaded.')).toBeNull();
  });

  it('asks the author to rate a resolved thread, once', async () => {
    const summary = { ...ownThread, status: 'resolved' };
    let rating: string | null = null;
    const ratings: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('widget/session')) {
          return new Response(
            JSON.stringify({ ...session, conversations: [summary] })
          );
        }
        if (url.endsWith('widget/conversations/c1/rating/')) {
          const body = JSON.parse(String(init?.body));
          ratings.push(body);
          rating = body.rating;
          return new Response(JSON.stringify({ ok: true }));
        }
        if (url.endsWith('widget/conversations/c1/')) {
          return new Response(
            JSON.stringify({
              conversation: { ...summary, rating },
              messages: [],
              attachments: [],
            })
          );
        }
        return new Response(JSON.stringify({ ok: true }));
      })
    );
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    fireEvent.click(await screen.findByRole('tab', { name: /Messages/ }));
    fireEvent.click(await screen.findByText('Export broken'));

    expect(await screen.findByText('How did we do?')).toBeTruthy();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Anything to add? (optional)' }),
      { target: { value: 'Quick fix' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Good' }));
    await screen.findByText('Thanks for your feedback.');
    expect(screen.queryByText('How did we do?')).toBe(null);
    expect(ratings).toEqual([{ rating: 'good', comment: 'Quick fix' }]);
  });

  it('offers no resolve button on a teammate’s shared thread', async () => {
    const summary = {
      ...ownThread,
      subject: 'Shared thread',
      own: false,
      sharedWithCompany: true,
    };
    mockApi({
      'widget/session': { ...session, conversations: [summary] },
      'widget/conversations/c1/': {
        conversation: summary,
        messages: [
          {
            id: 'm1',
            author: 'agent',
            name: 'Angelo',
            own: false,
            body: 'Looking into it.',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        attachments: [],
      },
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    fireEvent.click(await screen.findByRole('tab', { name: /Messages/ }));
    fireEvent.click(await screen.findByText('Shared thread'));
    await screen.findByText('Looking into it.');
    expect(screen.queryByRole('button', { name: 'Mark as resolved' })).toBe(
      null
    );
  });

  it('shows an agent what waits in the inbox, with a link to it', async () => {
    mockApi({
      'widget/session': {
        ...session,
        agent: { waiting: 3, url: 'https://app.test/support/conversations/' },
      },
    });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /3 conversations waiting/ })
    );
    expect(
      (await screen.findByRole('link', { name: /Open inbox/ })).getAttribute(
        'href'
      )
    ).toBe('https://app.test/support/conversations/');
  });

  it('fits the panel to the home view but not to the message list', async () => {
    mockApi({ 'widget/session': { ...session, conversations: [ownThread] } });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    const panel = await screen.findByRole('dialog');
    expect(panel.hasAttribute('data-fit')).toBe(true);
    fireEvent.click(await screen.findByRole('tab', { name: 'Messages' }));
    expect(panel.hasAttribute('data-fit')).toBe(false);
  });

  it('keeps Tab inside the full-screen sheet on phones', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(max-width: 480px)',
      addEventListener() {},
      removeEventListener() {},
    }));
    mockApi({ 'widget/session': session });
    render(
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        errors={() => []}
      />
    );
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    const panel = await screen.findByRole('dialog');
    await screen.findAllByRole('button', { name: /bug/i });
    const focusable = [
      ...panel.querySelectorAll<HTMLElement>('button, [href], input'),
    ].filter(el => !el.hasAttribute('disabled'));
    const last = focusable.at(-1) as HTMLElement;
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(focusable[0]);
    fireEvent.keyDown(focusable[0] as HTMLElement, {
      key: 'Tab',
      shiftKey: true,
    });
    expect(document.activeElement).toBe(last);
  });

  it('keeps the form fields from shrinking, through the display: contents fieldset', () => {
    expect(widgetCss).toMatch(/\.sent-fields \{ display: contents; \}/);
    expect(widgetCss).toMatch(/\.sent-fields > \*[^{]*\{ flex-shrink: 0; \}/);
  });

  it('uses the focus colour for focus rings only', () => {
    const rules = widgetCss.match(/[^{};]+\{[^{}]*var\(--s-focus\)[^{}]*\}/g);
    expect(rules?.length).toBeGreaterThan(0);
    for (const rule of rules ?? []) {
      expect(rule.slice(0, rule.indexOf('{'))).toMatch(/:focus/);
    }
  });

  it('reloads the session when the host signs in or out after mount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string, init?: RequestInit) => {
        const signedIn = new Headers(init?.headers).has('x-helpdesk-identity');
        return new Response(
          JSON.stringify(
            signedIn ? session : { ...session, identified: false, orgs: [] }
          ),
          { status: 200 }
        );
      })
    );
    const widget = (identityToken?: string) => (
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        types={['question']}
        identityToken={identityToken}
        errors={() => []}
      />
    );
    const { rerender } = render(widget());
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    expect(await screen.findByLabelText('Work email')).toBeTruthy();

    rerender(widget('signed-token'));
    await waitFor(() =>
      expect(screen.queryByLabelText('Work email')).toBeNull()
    );

    rerender(widget());
    expect(await screen.findByLabelText('Work email')).toBeTruthy();
  });

  it('keeps what the customer typed when the host refreshes the token for the same person', async () => {
    const tokenFor = (sub: string, exp: number) =>
      `h.${btoa(JSON.stringify({ sub, exp })).replace(/=+$/, '')}.s`;
    const fetch = vi.fn(
      async () => new Response(JSON.stringify(session), { status: 200 })
    );
    vi.stubGlobal('fetch', fetch);
    const widget = (identityToken: string) => (
      <Widget
        api="/api/support"
        inbox="support"
        locale="en"
        types={['bug']}
        identityToken={identityToken}
        errors={() => []}
      />
    );
    const { rerender } = render(widget(tokenFor('u1', 1)));
    fireEvent.click(screen.getByRole('button', { name: 'Open support' }));
    const body = await screen.findByRole('textbox', { name: 'What happened?' });
    body.innerHTML = 'The export hangs';
    fireEvent.input(body);
    const calls = fetch.mock.calls.length;

    rerender(widget(tokenFor('u1', 2)));
    expect(
      screen.getByRole('textbox', { name: 'What happened?' }).textContent
    ).toBe('The export hangs');
    expect(fetch.mock.calls.length).toBe(calls);
  });
});
