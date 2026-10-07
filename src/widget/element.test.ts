// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { defineHelpdeskConversations, defineHelpdeskWidget } from './element';

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

it('renders <helpdesk-conversations> in the page, in its own shadow root, without a launcher', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            identified: true,
            name: 'Ada',
            email: 'ada@example.test',
            orgs: [],
            types: ['question'],
            team: [],
            inbox: null,
            conversations: [],
          })
        )
    )
  );
  defineHelpdeskConversations();
  document.body.innerHTML =
    '<helpdesk-conversations api="/api/helpdesk" inbox="support" locale="en"></helpdesk-conversations>';
  const element = document.querySelector('helpdesk-conversations');
  const shadow = element?.shadowRoot;
  expect(shadow).toBeTruthy();
  expect(shadow?.querySelector('style')?.textContent).toContain(
    '.panel[data-inline]'
  );
  await waitFor(() =>
    expect(shadow?.querySelector('[role="region"]')).toBeTruthy()
  );
  expect(shadow?.querySelector('.launcher')).toBeNull();
});

it('opens <helpdesk-widget> on the form a host asks for', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            identified: true,
            name: 'Ada',
            email: 'ada@example.test',
            orgs: [],
            types: ['question', 'bug'],
            team: [],
            inbox: null,
            conversations: [],
          })
        )
    )
  );
  defineHelpdeskWidget();
  document.body.innerHTML =
    '<helpdesk-widget api="/api/helpdesk" inbox="support" locale="en"></helpdesk-widget>';
  const element = document.querySelector('helpdesk-widget') as HTMLElement & {
    open(options?: { type?: string }): void;
  };
  await waitFor(() =>
    expect(element.shadowRoot?.querySelector('.launcher')).toBeTruthy()
  );
  element.open({ type: 'bug' });
  await waitFor(() =>
    expect(
      element.shadowRoot
        ?.querySelector('[role="dialog"]')
        ?.getAttribute('aria-label')
    ).toBe('Report a bug')
  );
});
