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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';

import { ApiError } from '../ui/api';
import { HelpdeskAdmin } from './index';
import { formatSnooze } from './snooze';

const me = {
  agent: { id: 'a1', name: 'Agent' },
  referencePrefix: 'DG',
  types: ['question', 'bug'],
  statuses: ['open', 'pending', 'resolved'],
  priorities: ['low', 'normal', 'high', 'urgent'],
  inboxes: ['support', 'sales'],
  inboxNames: { sales: { en: 'Sales' } },
  inboxHours: {},
  segments: {},
  leadStages: ['lead', 'customer'],
  dealStages: ['new', 'won'],
  customFields: {},
  ai: false,
};

const conversation = {
  id: 'c1',
  reference: 'DG-1000',
  subject: 'Export broken',
  type: 'bug',
  status: 'open',
  priority: 'high',
  inbox: 'support',
  waitingSince: new Date(Date.now() - 3 * 3600_000).toISOString(),
  lastMessageAt: new Date().toISOString(),
  assigneeId: null,
  companyId: null,
  tags: ['billing'],
  contact: { id: 'p1', name: 'Ada', email: 'ada@example.test' },
  context: { url: 'javascript:alert(1)', title: 'Controls' },
  aiSuggestion: null,
};

const routes: Record<string, unknown> = {
  'agent/me/': me,
  'agent/conversations/?': { conversations: [conversation] },
  'agent/conversations/c1/': {
    conversation,
    contact: {
      id: 'p1',
      name: 'Ada',
      email: 'ada@example.test',
      verified: true,
    },
    company: null,
    suggestedCompany: null,
    customerContext: {},
    participants: [],
    viewers: [],
    messages: [
      {
        id: 'm1',
        authorType: 'contact',
        body: 'The CSV export fails',
        internal: false,
        createdAt: new Date().toISOString(),
        agentName: null,
        contactName: 'Ada',
      },
    ],
    attachments: [],
    events: [],
  },
  'agent/agents/': { agents: [] },
  'agent/canned/': { replies: [] },
  'agent/tags/': { tags: ['billing', 'vip'] },
  'agent/settings/': { confirmation: {} },
  'agent/deals/': { deals: [] },
};

const original = routes['agent/conversations/c1/'];

// A URL with no entry in `routes` fails the test instead of getting an empty body.
const unrouted: string[] = [];
const respond = (url: string) => {
  const key = Object.keys(routes)
    .sort((a, b) => b.length - a.length)
    .find(k => url.includes(k));
  if (key) return new Response(JSON.stringify(routes[key]));
  unrouted.push(url);
  return new Response('{}', { status: 404 });
};

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, '', '/support/conversations/');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => respond(String(input)))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  expect(unrouted.splice(0)).toEqual([]);
});

describe('HelpdeskAdmin', () => {
  it('lists waiting conversations and opens one as a deep link', async () => {
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const row = await screen.findByRole('link', { name: /DG-1000/ });
    expect(screen.getByText('3 hr')).toBeTruthy();

    fireEvent.click(row);
    expect(window.location.pathname).toBe('/support/conversations/c1/');
    expect(await screen.findByText('The CSV export fails')).toBeTruthy();
  });

  it('shows the open count on each assignee tab and keeps it while another tab loads', async () => {
    routes['agent/conversations/?'] = {
      conversations: [conversation],
      counts: { all: 4, mine: 1, unassigned: 2 },
    };
    onTestFinished(() => {
      routes['agent/conversations/?'] = { conversations: [conversation] };
    });
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const group = await screen.findByRole('group', { name: 'Assignee' });
    const tabs = () =>
      within(group)
        .getAllByRole('button')
        .map(b => `${b.textContent}${b.ariaPressed === 'true' ? ' *' : ''}`);
    await waitFor(() =>
      expect(tabs()).toEqual(['All 4 *', 'Assigned to me 1', 'Unassigned 2'])
    );

    fireEvent.click(within(group).getByRole('button', { name: /me/ }));
    expect(tabs()).toEqual(['All 4', 'Assigned to me 1 *', 'Unassigned 2']);
  });

  it('says who else has the conversation open, above the reply too, and drops them once they leave', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    onTestFinished(() => {
      vi.useRealTimers();
      routes['agent/conversations/c1/'] = original;
    });
    routes['agent/conversations/c1/'] = {
      ...(original as object),
      viewers: [
        { id: 'a2', name: 'Grace', avatarUrl: null },
        { id: 'a3', name: 'Linus', avatarUrl: null },
      ],
    };
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);

    expect(await screen.findByText('Grace and Linus are viewing')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      'Someone else on the team has this conversation open. Check they are not replying already.'
    );

    routes['agent/conversations/c1/'] = original;
    await act(() => vi.advanceTimersByTimeAsync(5000));
    await waitFor(() =>
      expect(screen.queryByText('Grace and Linus are viewing')).toBeNull()
    );
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('never renders a non-http context URL as a link', async () => {
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const context = (await screen.findByText('Captured context')).closest(
      'div'
    );
    if (!context) throw new Error('missing context card');
    expect(
      within(context).getByText('javascript:alert(1)').closest('a')
    ).toBeNull();
  });

  it('shows pasted code and captured errors as code blocks with a copy button', async () => {
    const trace = '<script>alert(1)</script>\n    at f (a.js:1:1)';
    routes['agent/conversations/c1/'] = {
      ...(original as object),
      conversation: {
        ...conversation,
        context: { errors: ['Error: <img src=x onerror=alert(2)>'] },
      },
      messages: [
        {
          id: 'm1',
          authorType: 'contact',
          body: `It broke:\n\`\`\`\n${trace}\n\`\`\``,
          internal: false,
          createdAt: new Date().toISOString(),
          agentName: null,
          contactName: 'Ada',
        },
      ],
    };
    onTestFinished(() => {
      routes['agent/conversations/c1/'] = original;
    });
    window.history.replaceState(null, '', '/support/conversations/c1/');
    const { container } = render(
      <HelpdeskAdmin basePath="/support" locale="en" />
    );
    await screen.findByText('It broke:');
    fireEvent.click(screen.getByText('1 recent error'));

    expect(
      [...container.querySelectorAll('.code pre')].map(p => p.textContent)
    ).toEqual([trace, 'Error: <img src=x onerror=alert(2)>']);
    expect(screen.getAllByRole('button', { name: 'Copy code' })).toHaveLength(
      2
    );
    expect(container.querySelector('script, img')).toBeNull();
  });

  it('clears a sent reply when resolving it fails, so a retry cannot send it twice', async () => {
    const posts: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST') posts.push(url);
        if (init?.method === 'PATCH')
          return new Response('{}', { status: 500 });
        return respond(url);
      })
    );
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const composer = await screen.findByRole('textbox', { name: 'Reply' });
    composer.innerHTML = 'Fixed in the next release';
    fireEvent.input(composer);

    fireEvent.click(screen.getByRole('button', { name: 'Send and resolve' }));

    expect(
      await screen.findByText(
        'Sent, but the conversation could not be resolved.'
      )
    ).toBeTruthy();
    expect(composer.textContent).toBe('');
    expect(posts.filter(u => u.includes('/messages'))).toHaveLength(1);
  });

  it('keeps the unsent reply and note across navigation and a reload, and clears only what was sent', async () => {
    const posts: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST') posts.push(JSON.parse(String(init.body)));
        return respond(url);
      })
    );
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const type = (box: HTMLElement, text: string) => {
      box.innerHTML = text;
      fireEvent.input(box);
    };
    type(await screen.findByRole('textbox', { name: 'Reply' }), 'Half a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Internal note' }));
    type(
      screen.getByRole('textbox', { name: 'Internal note' }),
      'Ask billing first'
    );

    fireEvent.click(screen.getByRole('link', { name: 'Inbox' }));
    fireEvent.click(await screen.findByRole('link', { name: /DG-1000/ }));
    expect(
      (await screen.findByRole('textbox', { name: 'Internal note' }))
        .textContent
    ).toBe('Ask billing first');

    cleanup();
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    expect(
      (await screen.findByRole('textbox', { name: 'Internal note' }))
        .textContent
    ).toBe('Ask billing first');
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    const reply = screen.getByRole('textbox', { name: 'Reply' });
    expect(reply.textContent).toBe('Half a reply');

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Sent')).toBeTruthy();
    expect(reply.textContent).toBe('');
    expect(posts).toEqual([{ body: 'Half a reply', internal: false }]);

    cleanup();
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    expect(
      (await screen.findByRole('textbox', { name: 'Reply' })).textContent
    ).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Internal note' }));
    expect(
      screen.getByRole('textbox', { name: 'Internal note' }).textContent
    ).toBe('Ask billing first');
  });

  it('keeps a draft when sending it fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST') return new Response('{}', { status: 500 });
        return respond(url);
      })
    );
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const composer = await screen.findByRole('textbox', { name: 'Reply' });
    composer.innerHTML = 'Half a reply';
    fireEvent.input(composer);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Something went wrong.')).toBeTruthy();

    cleanup();
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    expect(
      (await screen.findByRole('textbox', { name: 'Reply' })).textContent
    ).toBe('Half a reply');
  });

  it('never brings back a reply that finished sending after the agent left the conversation', async () => {
    let release = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST')
          await new Promise<void>(resolve => {
            release = resolve;
          });
        return respond(url);
      })
    );
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const composer = await screen.findByRole('textbox', { name: 'Reply' });
    composer.innerHTML = 'Already sent';
    fireEvent.input(composer);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.click(screen.getByRole('link', { name: 'Inbox' }));
    await screen.findByRole('link', { name: /DG-1000/ });
    release();
    await waitFor(() =>
      expect(sessionStorage.getItem('helpdesk.draft.a1.c1')).toBeNull()
    );

    fireEvent.click(screen.getByRole('link', { name: /DG-1000/ }));
    expect(
      (await screen.findByRole('textbox', { name: 'Reply' })).textContent
    ).toBe('');
  });

  it('puts an AI draft in the reply and leaves the note alone', async () => {
    routes['agent/me/'] = { ...me, ai: true };
    routes['agent/conversations/c1/draft'] = { text: 'Try the new export' };
    onTestFinished(() => {
      routes['agent/me/'] = me;
      delete routes['agent/conversations/c1/draft'];
    });
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    await screen.findByRole('textbox', { name: 'Reply' });
    fireEvent.click(screen.getByRole('button', { name: 'Internal note' }));
    const note = screen.getByRole('textbox', { name: 'Internal note' });
    note.innerHTML = 'Ask billing first';
    fireEvent.input(note);

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }));

    expect(
      (await screen.findByRole('textbox', { name: 'Reply' })).textContent
    ).toBe('Try the new export');
    fireEvent.click(screen.getByRole('button', { name: 'Internal note' }));
    expect(
      screen.getByRole('textbox', { name: 'Internal note' }).textContent
    ).toBe('Ask billing first');
  });

  it('never shows a draft to another agent signed in to the same browser', async () => {
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const composer = await screen.findByRole('textbox', { name: 'Reply' });
    composer.innerHTML = 'Half a reply';
    fireEvent.input(composer);
    cleanup();

    routes['agent/me/'] = { ...me, agent: { id: 'a2', name: 'Other' } };
    onTestFinished(() => {
      routes['agent/me/'] = me;
    });
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    expect(
      (await screen.findByRole('textbox', { name: 'Reply' })).textContent
    ).toBe('');
  });

  it('still sends when the browser blocks storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    onTestFinished(() => {
      vi.restoreAllMocks();
    });
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const composer = await screen.findByRole('textbox', { name: 'Reply' });
    composer.innerHTML = 'Fixed in the next release';
    fireEvent.input(composer);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Sent')).toBeTruthy();
    expect(composer.textContent).toBe('');
  });

  it('filters the inbox by a tag on a row and keeps it across other filters', async () => {
    const lists: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.includes('agent/conversations/?')) lists.push(url);
        return respond(url);
      })
    );
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Filter by tag: billing' })
    );
    expect(window.location.search).toContain('tag=billing');
    expect(
      (screen.getByRole('combobox', { name: 'Tag' }) as HTMLInputElement).value
    ).toBe('billing');

    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: 'pending' },
    });
    expect(window.location.search).toContain('tag=billing');
    await waitFor(() => {
      const query = new URL(lists.at(-1) ?? '', 'http://x.test').searchParams;
      expect([query.get('status'), query.get('tag')]).toEqual([
        'pending',
        'billing',
      ]);
    });
    expect(window.location.pathname).toBe('/support/conversations/');
  });

  it('saves the tags typed under the title as a list', async () => {
    const patches: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'PATCH')
          patches.push(JSON.parse(String(init.body)));
        return respond(url);
      })
    );
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const input = (await screen.findByRole('combobox', {
      name: 'Tags',
    })) as HTMLInputElement;
    expect(input.value).toBe('billing');

    fireEvent.change(input, {
      target: { value: 'billing, Refunds, BILLING,' },
    });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(patches).toEqual([{ tags: ['billing', 'refunds'] }])
    );
  });

  it('shows the saved tags and an error when saving them fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (init?.method === 'PATCH')
          return new Response(JSON.stringify({ error: 'invalid' }), {
            status: 400,
          });
        const url = String(input);
        return respond(url);
      })
    );
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const input = (await screen.findByRole('combobox', {
      name: 'Tags',
    })) as HTMLInputElement;

    fireEvent.change(input, {
      target: { value: `billing, ${'x'.repeat(51)}` },
    });
    fireEvent.blur(input);

    expect(await screen.findByText('Something went wrong.')).toBeTruthy();
    expect(input.value).toBe('billing');
  });

  it('snoozes a conversation until tomorrow morning and says until when', async () => {
    const patches: Record<string, unknown>[] = [];
    let snoozedUntil: string | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'PATCH') {
          const body = JSON.parse(String(init.body));
          patches.push(body);
          snoozedUntil = body.snoozedUntil;
        }
        if (url.includes('agent/conversations/c1/')) {
          const detail = original as { conversation: object };
          return new Response(
            JSON.stringify({
              ...detail,
              conversation: {
                ...detail.conversation,
                status: snoozedUntil ? 'pending' : 'open',
                snoozedUntil,
              },
            })
          );
        }
        return respond(url);
      })
    );
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const select = await screen.findByRole('combobox', { name: 'Snooze' });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    fireEvent.change(select, { target: { value: 'tomorrow' } });

    await waitFor(() =>
      expect(
        (select as HTMLSelectElement).selectedOptions[0]?.textContent
      ).toBe(`Snoozed until ${formatSnooze(tomorrow, 'en')}`)
    );
    expect(patches).toEqual([{ snoozedUntil: tomorrow.toISOString() }]);

    fireEvent.change(select, { target: { value: 'off' } });
    await waitFor(() =>
      expect(
        (select as HTMLSelectElement).selectedOptions[0]?.textContent
      ).toBe('Snooze')
    );
    expect(patches.at(-1)).toEqual({ snoozedUntil: null });
  });

  it('snoozes until a picked time, opened with the z key', async () => {
    const patches: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'PATCH')
          patches.push(JSON.parse(String(init.body)));
        return respond(url);
      })
    );
    window.history.replaceState(null, '', '/support/conversations/c1/');
    // z is pressed in the first moment the select is in the page, before
    // React runs the passive effects of the commit that added it.
    const select = await new Promise<HTMLElement>(resolve => {
      const observer = new MutationObserver(() => {
        const shown = document.querySelector<HTMLElement>(
          'select[aria-label="Snooze"]'
        );
        if (!shown) return;
        observer.disconnect();
        fireEvent.keyDown(document.body, { key: 'z' });
        resolve(shown);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      render(<HelpdeskAdmin basePath="/support" locale="en" />);
    });
    expect(document.activeElement).toBe(select);

    fireEvent.change(select, { target: { value: 'pick' } });
    const input = screen.getByLabelText('Snooze until') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    const until = new Date();
    until.setDate(until.getDate() + 3);
    until.setHours(10, 15, 0, 0);
    const value = new Date(until.getTime() - until.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Snooze' }));

    await waitFor(() =>
      expect(screen.queryByLabelText('Snooze until')).toBeNull()
    );
    expect(patches).toEqual([{ snoozedUntil: until.toISOString() }]);
  });

  it('says so when the server refuses a snooze and keeps the conversation awake', async () => {
    const patches: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          patches.push(JSON.parse(String(init.body)));
          return new Response(JSON.stringify({ error: 'invalid' }), {
            status: 400,
          });
        }
        const url = String(input);
        return respond(url);
      })
    );
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);
    const select = await screen.findByRole('combobox', { name: 'Snooze' });

    fireEvent.change(select, { target: { value: 'tomorrow' } });

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Snoozing failed. Nothing changed.'
    );
    expect(patches).toHaveLength(1);
    expect((select as HTMLSelectElement).selectedOptions[0]?.textContent).toBe(
      'Snooze'
    );
  });

  it('marks the section it is in and scrolls that tab into the rail', async () => {
    // jsdom has no layout, so the method the rail calls does not exist there.
    const scrollIntoView = vi.fn();
    const absent = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    onTestFinished(() => {
      Element.prototype.scrollIntoView = absent;
    });
    window.history.replaceState(null, '', '/support/settings/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);

    const nav = await screen.findByRole('navigation', { name: 'Sections' });
    const current = within(nav).getByRole('button', { current: 'page' });
    expect(current.textContent).toBe('Settings');
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

    fireEvent.click(within(nav).getByRole('button', { name: 'Deals' }));
    expect(
      within(nav).getByRole('button', { current: 'page' }).textContent
    ).toBe('Deals');
  });

  it('says so when saving the settings fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          return new Response('{}', { status: 400 });
        }
        const url = String(input);
        if (url.includes('agent/settings')) {
          return new Response(JSON.stringify({ confirmation: {} }));
        }
        if (url.includes('agent/agents')) {
          return new Response(JSON.stringify({ agents: [] }));
        }
        return new Response(JSON.stringify(me));
      })
    );
    window.history.replaceState(null, '', '/support/settings/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Something went wrong.')).toBeTruthy();
  });

  it('removes a former teammate from the team, never the agent themselves', async () => {
    let team = [
      { id: 'a1', name: 'Agent', email: 'agent@example.test' },
      { id: 'a2', name: 'Former', email: 'former@example.test' },
    ];
    const removed: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'DELETE') {
          const id = url.match(/agent\/agents\/([^/]+)/)?.[1] ?? '';
          removed.push(id);
          team = team.filter(a => a.id !== id);
          return new Response('{"ok":true}');
        }
        if (url.includes('agent/settings')) {
          return new Response(JSON.stringify({ confirmation: {} }));
        }
        if (url.includes('agent/agents')) {
          return new Response(JSON.stringify({ agents: team }));
        }
        return new Response(JSON.stringify(me));
      })
    );
    window.history.replaceState(null, '', '/support/settings/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);

    expect(await screen.findByText('Former')).toBeTruthy();
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    expect(removeButtons).toHaveLength(1);
    fireEvent.click(removeButtons[0] as HTMLElement);
    expect(removed).toEqual([]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove and unassign?' })
    );

    await vi.waitFor(() => expect(screen.queryByText('Former')).toBeNull());
    expect(removed).toEqual(['a2']);
  });

  it('marks a customer message nobody proved, and names an automatic reply', async () => {
    routes['agent/conversations/c1/'] = {
      ...(routes['agent/conversations/c1/'] as object),
      messages: [
        {
          id: 'm1',
          authorType: 'contact',
          body: 'Typed into the form',
          internal: false,
          verified: false,
          createdAt: new Date().toISOString(),
          agentName: null,
          contactName: 'Ada',
        },
        {
          id: 'm2',
          authorType: 'system',
          body: 'I am out of office, see [my calendar](https://evil.test/c)',
          internal: true,
          verified: null,
          createdAt: new Date().toISOString(),
          agentName: null,
          contactName: null,
        },
      ],
    };
    onTestFinished(() => {
      routes['agent/conversations/c1/'] = original;
    });
    window.history.replaceState(null, '', '/support/conversations/c1/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);

    const typed = (await screen.findByText('Typed into the form')).closest(
      'article'
    );
    expect(typed?.querySelector('header')?.textContent).toContain('Unverified');
    const auto = screen.getByText('my calendar').closest('article');
    expect(auto?.querySelector('header')?.textContent).toContain(
      'Automatic reply'
    );
    expect(auto?.textContent).toContain('(evil.test)');
  });

  it('interleaves the conversation events with the messages as one line each', async () => {
    const at = (minute: number) =>
      new Date(Date.UTC(2026, 8, 1, 9, minute)).toISOString();
    const event = (
      minute: number,
      kind: string,
      data: Record<string, unknown> = {},
      agent: string | null = 'a2'
    ) => ({
      id: `e${minute}`,
      kind,
      data,
      agentId: agent,
      agentName: agent === 'a2' ? 'Grace' : null,
      createdAt: at(minute),
    });
    const until = at(50);
    routes['agent/agents/'] = {
      agents: [{ id: 'a2', name: 'Grace', email: 'grace@devguard.test' }],
    };
    routes['agent/conversations/c1/'] = {
      ...(original as object),
      participants: [{ id: 'p2', name: 'Bob', email: 'bob@example.test' }],
      messages: [
        {
          id: 'm1',
          authorType: 'contact',
          body: 'The CSV export fails',
          internal: false,
          verified: true,
          createdAt: at(0),
          agentName: null,
          contactName: 'Ada',
        },
        {
          id: 'm2',
          authorType: 'agent',
          body: 'Looking into it',
          internal: false,
          verified: null,
          createdAt: at(5),
          agentName: 'Grace',
          contactName: null,
        },
      ],
      events: [
        event(
          1,
          'email.sent',
          { kind: 'agent-new', to: ['grace@devguard.test'] },
          null
        ),
        event(2, 'assigneeId', { from: null, to: 'a2' }),
        event(2, 'status', { from: 'open', to: 'pending' }),
        event(6, 'tags', { from: ['billing'], to: ['vip'] }),
        event(7, 'snoozedUntil', { from: null, to: until }),
        event(8, 'status', { from: 'pending', to: 'open' }, null),
        event(9, 'reopened', {}, null),
        event(10, 'participant.added', { contactId: 'p2' }),
        event(11, 'priority', { from: 'normal', to: 'urgent' }, 'gone'),
        event(12, 'mystery'),
        event(
          13,
          'snoozedUntil',
          { from: until, to: null, by: 'customer' },
          null
        ),
        event(
          13,
          'status',
          { from: 'pending', to: 'resolved', by: 'customer' },
          null
        ),
      ],
    };
    onTestFinished(() => {
      routes['agent/conversations/c1/'] = original;
      routes['agent/agents/'] = { agents: [] };
    });
    window.history.replaceState(null, '', '/support/conversations/c1/');
    const { container } = render(
      <HelpdeskAdmin basePath="/support" locale="en" />
    );
    await screen.findByText('Grace assigned this to Grace');

    const thread = [
      ...container.querySelectorAll('.sa-thread > article, .sa-thread > p'),
    ].map(el =>
      el.tagName === 'P'
        ? (el.firstChild?.textContent ?? '')
        : (el.querySelector('.sa-msg-body')?.textContent ?? '')
    );
    expect(thread).toEqual([
      'The CSV export fails',
      'New-conversation email sent to grace@devguard.test',
      'Grace assigned this to Grace',
      'Grace set the status to Waiting on customer',
      'Looking into it',
      'Grace added tags: vip · Grace removed tags: billing',
      `Grace snoozed this until ${formatSnooze(until, 'en')}`,
      'Status changed to Open',
      'A customer reply reopened this',
      'Grace added Bob',
      'A former agent set the priority to Urgent',
      'The customer marked this resolved',
    ]);
  });

  it.each([
    ['/support/conversations/', 'agent/conversations/?', 'thead th', 4],
    ['/support/conversations/c1/', 'agent/conversations/c1/', '.sa-fields', 1],
    ['/support/contacts/', 'agent/contacts/', 'thead th', 6],
    ['/support/companies/', 'agent/companies/', 'thead th', 4],
    ['/support/contacts/p1/', 'agent/contacts/p1/', '.sa-summary', 1],
    ['/support/companies/o1/', 'agent/companies/o1/', '.sa-summary', 0],
  ])(
    'shows %s as a busy skeleton of the page until it loads',
    async (path, pending, shape, count) => {
      vi.stubGlobal(
        'fetch',
        vi.fn((input: string) => {
          const url = String(input);
          if (url.includes(pending)) return new Promise(() => {});
          if (url.includes('agent/me/'))
            return Promise.resolve(new Response(JSON.stringify(me)));
          return Promise.resolve(new Response('{}'));
        })
      );
      window.history.replaceState(null, '', path);
      const { container } = render(
        <HelpdeskAdmin basePath="/support" locale="en" />
      );

      const busy = await vi.waitFor(() => {
        const found = container.querySelector('[aria-busy="true"]');
        if (!found) throw new Error('nothing busy');
        return found;
      });
      expect(busy.textContent).toBe('Loading…');
      expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
      expect(busy.querySelectorAll(shape)).toHaveLength(count);
    }
  );

  it.each([
    '/support/contacts/',
    '/support/companies/',
    '/support/contacts/p1/',
    '/support/companies/o1/',
  ])(
    'replaces the skeleton of %s with an error when loading fails',
    async path => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string) =>
          String(input).includes('agent/me/')
            ? new Response(JSON.stringify(me))
            : new Response('{}', { status: 500 })
        )
      );
      window.history.replaceState(null, '', path);
      const { container } = render(
        <HelpdeskAdmin basePath="/support" locale="en" />
      );

      expect(await screen.findByText('Something went wrong.')).toBeTruthy();
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    }
  );

  it('keeps an unhandled action failure on screen under a host router', async () => {
    render(
      <HelpdeskAdmin
        basePath="/support"
        locale="en"
        location={{ pathname: '/support/conversations/', search: '' }}
      />
    );
    await screen.findByRole('link', { name: /DG-1000/ });

    await act(async () => {
      window.dispatchEvent(
        Object.assign(new Event('unhandledrejection', { cancelable: true }), {
          reason: new ApiError(500, 'boom'),
        })
      );
    });

    expect(screen.getByRole('alert').textContent).toBe('Something went wrong.');
  });
});

describe('empty states', () => {
  const empty = (path: string) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        String(input).includes('agent/me/')
          ? new Response(JSON.stringify(me))
          : new Response(
              JSON.stringify({
                conversations: [],
                contacts: [],
                companies: [],
                replies: [],
                deals: [],
              })
            )
      )
    );
    window.history.replaceState(null, '', path);
    return render(<HelpdeskAdmin basePath="/support" locale="en" />);
  };

  it('says how the first conversation arrives on an empty inbox', async () => {
    empty('/support/conversations/');
    expect(await screen.findByText('No conversations yet.')).toBeTruthy();
    expect(
      screen.getByText(
        'The first message from the widget or by email shows up here.'
      )
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('names a filter that hides every conversation and clears it', async () => {
    empty('/support/conversations/?status=resolved&q=export');
    expect(
      await screen.findByText('Nothing matches these filters.')
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(window.location.pathname + window.location.search).toBe(
      '/support/conversations/'
    );
    expect(await screen.findByText('No conversations yet.')).toBeTruthy();
    expect(
      (screen.getByRole('searchbox', { name: 'Search' }) as HTMLInputElement)
        .value
    ).toBe('');
  });

  it.each([
    ['/support/contacts/', 'No contacts yet.'],
    ['/support/contacts/?q=nobody', 'Nothing matches these filters.'],
    ['/support/companies/', 'No companies yet.'],
    ['/support/companies/?q=nobody', 'Nothing matches these filters.'],
    ['/support/canned/', 'No canned replies yet.'],
  ])('tells %s what fills it', async (path, title) => {
    empty(path);
    expect(await screen.findByText(title)).toBeTruthy();
  });

  it('shows one empty state over an empty deals board, not one per column', async () => {
    empty('/support/deals/');
    expect(await screen.findByText('No deals yet.')).toBeTruthy();
    expect(screen.getAllByRole('region')).toHaveLength(me.dealStages.length);
    expect(screen.queryByText('Drag a deal here')).toBeNull();
  });
});
