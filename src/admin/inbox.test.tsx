// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

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
});

it('keeps the highlighted conversation when the rows re-sort', () => {
  const onOpen = vi.fn();
  const context = {
    t: translator('en'),
    locale: 'en',
    href: () => '#',
    inboxName: (key: string) => key,
  } as unknown as AdminContext;
  const table = (rows: ConversationRow[]) => (
    <AdminProvider value={context}>
      <ConversationTable rows={rows} onOpen={onOpen} keyboard />
    </AdminProvider>
  );
  const { rerender } = render(table([row('a'), row('b')]));

  fireEvent.keyDown(document.body, { key: 'j' });
  rerender(table([row('b'), row('a'), row('c')]));
  fireEvent.keyDown(document.body, { key: 'Enter' });

  expect(onOpen).toHaveBeenCalledWith('b');
});
