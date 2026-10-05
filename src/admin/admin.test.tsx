// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
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

const me = {
  agent: { id: 'a1', name: 'Agent' },
  referencePrefix: 'DG',
  types: ['question', 'bug'],
  statuses: ['open', 'pending', 'resolved'],
  priorities: ['low', 'normal', 'high', 'urgent'],
  inboxes: ['support', 'sales'],
  inboxNames: { sales: { en: 'Sales' } },
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
  },
  'agent/agents/': { agents: [] },
  'agent/canned/': { replies: [] },
  'agent/tags/': { tags: ['billing', 'vip'] },
  'agent/settings/': { confirmation: {} },
};

const original = routes['agent/conversations/c1/'];

beforeEach(() => {
  window.history.replaceState(null, '', '/support/conversations/');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = String(input);
      const key = Object.keys(routes)
        .sort((a, b) => b.length - a.length)
        .find(k => url.includes(k));
      return new Response(JSON.stringify(key ? routes[key] : {}));
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

  it('clears a sent reply when resolving it fails, so a retry cannot send it twice', async () => {
    const posts: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST') posts.push(url);
        if (init?.method === 'PATCH')
          return new Response('{}', { status: 500 });
        const key = Object.keys(routes)
          .sort((a, b) => b.length - a.length)
          .find(k => url.includes(k));
        return new Response(JSON.stringify(key ? routes[key] : {}));
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

  it('filters the inbox by a tag on a row and keeps it across other filters', async () => {
    const lists: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.includes('agent/conversations/?')) lists.push(url);
        const key = Object.keys(routes)
          .sort((a, b) => b.length - a.length)
          .find(k => url.includes(k));
        return new Response(JSON.stringify(key ? routes[key] : {}));
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
    await act(async () => {});
    expect(lists.at(-1)).toContain('tag=billing');
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
        const key = Object.keys(routes)
          .sort((a, b) => b.length - a.length)
          .find(k => url.includes(k));
        return new Response(JSON.stringify(key ? routes[key] : {}));
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

    await act(async () => {});
    expect(patches).toEqual([{ tags: ['billing', 'refunds'] }]);
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
        const key = Object.keys(routes)
          .sort((a, b) => b.length - a.length)
          .find(k => url.includes(k));
        return new Response(JSON.stringify(key ? routes[key] : {}));
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
    expect(scrollIntoView).toHaveBeenCalled();

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
