// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

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
