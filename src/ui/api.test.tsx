// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { useResource } from './api';

afterEach(cleanup);

it('keeps the newer key’s data when an older load resolves last', async () => {
  const pending = new Map<string, (value: string) => void>();
  const load = (key: string) => () =>
    new Promise<string>(resolve => pending.set(key, resolve));
  const { result, rerender } = renderHook(
    ({ key }) => useResource(load(key), key),
    { initialProps: { key: 'old' } }
  );

  rerender({ key: 'new' });
  await act(async () => pending.get('new')?.('new data'));
  await act(async () => pending.get('old')?.('old data'));

  expect(result.current.data).toBe('new data');
});
