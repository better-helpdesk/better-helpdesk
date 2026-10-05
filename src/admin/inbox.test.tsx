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
  me: {
    inboxHours: {
      support: {
        timeZone: 'Europe/Zurich',
        weekly: Object.fromEntries(
          ['mon', 'tue', 'wed', 'thu', 'fri'].map(d => [
            d,
            [['08:00', '17:00']],
          ])
        ),
      },
    },
  },
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

it('leaves j to the text when typed in an editable field, and takes it from inside a shadow root', () => {
  const { container } = render(table([row('a'), row('b')], vi.fn()));
  const active = () => container.querySelectorAll('tr[data-active="true"]');
  const editor = document.createElement('div');
  editor.setAttribute('contenteditable', 'true');
  editor.append(document.createElement('b'));
  document.body.append(editor);
  onTestFinished(() => editor.remove());

  fireEvent.keyDown(editor.firstChild as Element, { key: 'j' });
  expect(active()).toHaveLength(0);

  const host = document.createElement('div');
  const button = document.createElement('button');
  host.attachShadow({ mode: 'open' }).append(button);
  const field = document.createElement('input');
  host.shadowRoot?.append(field);
  document.body.append(host);
  onTestFinished(() => host.remove());

  fireEvent.keyDown(field, { key: 'j', composed: true });
  expect(active()).toHaveLength(0);
  fireEvent.keyDown(button, { key: 'j', composed: true });
  expect(active()).toHaveLength(1);
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

it('marks only unread conversations as unread, waiting or not', () => {
  const { container } = render(
    table(
      [
        { ...row('a'), unread: true },
        { ...row('b'), waitingSince: new Date().toISOString(), unread: false },
      ],
      vi.fn()
    )
  );
  const links = [...container.querySelectorAll('tbody a')].map(
    a => a.textContent
  );
  expect(links).toEqual(['Unread DG-a a', 'DG-b b']);
  expect(container.querySelectorAll('tr[data-unread]')).toHaveLength(1);
});

it('stacks the agents viewing a conversation on its row', () => {
  const { getByRole } = render(
    table(
      [
        {
          ...row('a'),
          viewers: [
            { id: 'a2', name: 'Grace Hopper' },
            { id: 'a3', name: 'Linus' },
            { id: 'a4', name: 'Ken' },
          ],
        },
      ],
      vi.fn()
    )
  );
  const stack = getByRole('img', {
    name: 'Grace Hopper and 2 others are viewing',
  });
  expect(stack.textContent).toBe('GHLK');
});

it('colours the wait by open hours in an inbox with hours, by the clock in one without', () => {
  // Monday 26 October 09:00 in Zurich, the first Monday after DST ends.
  vi.useFakeTimers({ now: new Date('2026-10-26T08:00:00Z'), toFake: ['Date'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  // Friday 17:30, after closing.
  const waitingSince = '2026-10-23T15:30:00Z';
  const { container } = render(
    table(
      [
        { ...row('a'), waitingSince },
        { ...row('b'), inbox: 'sales', waitingSince },
      ],
      vi.fn()
    )
  );
  const tones = [...container.querySelectorAll('td.num .sa-pill')].map(p =>
    p.getAttribute('data-tone')
  );
  expect(tones).toEqual([null, 'late']);
});
