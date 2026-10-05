// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, onTestFinished, vi } from 'vitest';

import { translator } from '../ui/i18n';
import { type AdminContext, AdminProvider } from './context';
import { type ConversationRow, ConversationTable } from './inbox';

afterEach(cleanup);

const row = (id: string): ConversationRow => ({
  id,
  reference: `DG-${id}`,
  subject: id,
  type: 'question',
  status: 'open',
  priority: 'normal',
  inbox: 'support',
  waitingSince: null,
  lastMessageAt: new Date().toISOString(),
  assigneeId: null,
  tags: [],
});

const context = {
  t: translator('en'),
  locale: 'en',
  href: () => '#',
  inboxName: (key: string) => key,
} as unknown as AdminContext;

const table = (rows: ConversationRow[], onOpen: (id: string) => void) => (
  <AdminProvider value={context}>
    <ConversationTable rows={rows} onOpen={onOpen} keyboard />
  </AdminProvider>
);

it('highlights no conversation until the first j or k, which lands on the first row', () => {
  const onOpen = vi.fn();
  const { container } = render(table([row('a'), row('b')], onOpen));
  const active = () =>
    [...container.querySelectorAll('tr[data-active="true"]')].map(
      tr => tr.textContent
    );

  expect(active()).toEqual([]);
  fireEvent.keyDown(document.body, { key: 'Enter' });
  expect(onOpen).not.toHaveBeenCalled();

  fireEvent.keyDown(document.body, { key: 'j' });
  expect(active()).toHaveLength(1);
  expect(active()[0]).toContain('DG-a');
});

it('keeps the highlighted conversation when the rows re-sort', () => {
  const onOpen = vi.fn();
  const { rerender } = render(table([row('a'), row('b')], onOpen));

  fireEvent.keyDown(document.body, { key: 'j' });
  fireEvent.keyDown(document.body, { key: 'j' });
  rerender(table([row('b'), row('a'), row('c')], onOpen));
  fireEvent.keyDown(document.body, { key: 'Enter' });

  expect(onOpen).toHaveBeenCalledWith('b');
});

it('shows until when a snoozed conversation wakes in place of how long it waited', () => {
  vi.useFakeTimers({ now: new Date(2026, 9, 5, 12), toFake: ['Date'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const until = new Date(2026, 9, 12, 9);
  const { container } = render(
    table(
      [
        {
          ...row('a'),
          status: 'pending',
          waitingSince: new Date(Date.now() - 3 * 3600_000).toISOString(),
          snoozedUntil: until.toISOString(),
        },
      ],
      vi.fn()
    )
  );
  const cell = container.querySelector('td');
  expect(cell?.textContent).toBe('until Mon 12 Oct, 09:00');
});
