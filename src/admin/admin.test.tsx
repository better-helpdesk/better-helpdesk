// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
};

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
        return new Response(JSON.stringify(me));
      })
    );
    window.history.replaceState(null, '', '/support/settings/');
    render(<HelpdeskAdmin basePath="/support" locale="en" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Something went wrong.')).toBeTruthy();
  });

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
