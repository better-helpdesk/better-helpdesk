// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Widget } from './widget';

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
      const key = Object.keys(routes).find(k => url.includes(k));
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
  team: [{ name: 'Angelo', initials: 'AD' }],
  inbox: null,
  conversations: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Widget', () => {
  it('sends a bug report with the context the user kept', async () => {
    const calls = mockApi({
      'widget/session': session,
      'widget/conversations/': {
        conversation: { id: 'c1', reference: 'DG-1000' },
      },
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

  it('shows each captured page error and sends only the ones left ticked', async () => {
    const calls = mockApi({
      'widget/session': session,
      'widget/conversations/': {
        conversation: { id: 'c1', reference: 'DG-1000' },
      },
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
    const post = calls.find(
      c => c.method === 'POST' && c.url.endsWith('widget/conversations/')
    );
    if (!post) throw new Error('no conversation was posted');
    expect(
      (post.body as { context: { errors?: string[] } }).context.errors
    ).toEqual(['ReferenceError: y']);
  });

  it('shows where a labelled link goes in a colleague’s message, not in one’s own', async () => {
    Element.prototype.scrollIntoView = () => {};
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
      await screen.findByRole('button', { name: /3 conversations are waiting/ })
    );
    expect(
      (await screen.findByRole('link', { name: /Open inbox/ })).getAttribute(
        'href'
      )
    ).toBe('https://app.test/support/conversations/');
  });
});
