// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, onTestFinished, vi } from 'vitest';

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

it('polls a hidden page only when asked to', async () => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'hidden',
  });
  onTestFinished(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });
  let quiet = 0;
  let awake = 0;
  renderHook(() => {
    useResource(async () => ++quiet, 'quiet', 1000);
    useResource(async () => ++awake, 'awake', 1000, { whenHidden: true });
  });
  await act(async () => vi.advanceTimersByTimeAsync(3000));

  expect(quiet).toBe(1);
  expect(awake).toBe(4);
});
