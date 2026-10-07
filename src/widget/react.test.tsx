// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import type { HelpdeskWidgetElement } from './element';
import { HelpdeskConversations, HelpdeskWidget } from './react';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([
  ['helpdesk-widget', HelpdeskWidget],
  ['helpdesk-conversations', HelpdeskConversations],
] as const)(
  'hands context to <%s> through its setter on the first mount',
  (tag, Wrapper) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 }))
    );
    const { container } = render(<Wrapper context={{ plan: 'pro' }} />);
    const element = container.querySelector(tag) as HTMLElement & {
      context: Record<string, string>;
    };
    expect(Object.hasOwn(element, 'context')).toBe(false);
    expect(element.context).toEqual({ plan: 'pro' });
  }
);

it.each([
  ['helpdesk-widget', HelpdeskWidget],
  ['helpdesk-conversations', HelpdeskConversations],
] as const)('sets the theme attribute on <%s>', (tag, Wrapper) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 500 }))
  );
  const { container } = render(<Wrapper theme="auto" />);
  expect(container.querySelector(tag)?.getAttribute('theme')).toBe('auto');
});

it('hands the host a ref to the element, whose open() opens the bug form', async () => {
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
  const ref = createRef<HelpdeskWidgetElement>();
  render(<HelpdeskWidget ref={ref} context={{ plan: 'pro' }} />);
  expect(ref.current?.tagName).toBe('HELPDESK-WIDGET');
  expect(ref.current?.context).toEqual({ plan: 'pro' });
  ref.current?.open({ type: 'bug' });
  await waitFor(() =>
    expect(
      ref.current?.shadowRoot
        ?.querySelector('[role="dialog"]')
        ?.getAttribute('aria-label')
    ).toBe('Report a bug')
  );
});
