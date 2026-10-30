import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  eventStream,
  memoryRealtime,
  postgresRealtime,
  type RealtimeChange,
} from './realtime';

const change: RealtimeChange = { conversationId: 'c1', kind: 'message' };

async function read(response: Response) {
  return response.text();
}

afterEach(() => vi.useRealTimers());

describe('memoryRealtime', () => {
  it('hands a change to every subscriber until it leaves', () => {
    const realtime = memoryRealtime();
    const first: RealtimeChange[] = [];
    const second: RealtimeChange[] = [];
    const leave = realtime.subscribe(c => first.push(c));
    realtime.subscribe(c => second.push(c));

    realtime.publish(change);
    leave();
    realtime.publish({ ...change, kind: 'typing' });

    expect(first).toEqual([change]);
    expect(second).toEqual([change, { ...change, kind: 'typing' }]);
  });
});

describe('eventStream', () => {
  it('writes the changes it may show and ends with the request', async () => {
    const realtime = memoryRealtime();
    const abort = new AbortController();
    const response = eventStream(realtime, {
      request: new Request('https://app.test/events', { signal: abort.signal }),
      visible: c => c.conversationId === 'c1',
    });
    expect(response.headers.get('content-type')).toBe(
      'text/event-stream; charset=utf-8'
    );
    expect(response.headers.get('x-accel-buffering')).toBe('no');

    realtime.publish(change);
    realtime.publish({ conversationId: 'c2', kind: 'message' });
    await Promise.resolve();
    await Promise.resolve();
    abort.abort();

    const text = await read(response);
    expect(text).toContain(
      `event: change\ndata: ${JSON.stringify(change)}\n\n`
    );
    expect(text).not.toContain('c2');
  });

  it('keeps the connection warm and closes itself at its limit', async () => {
    vi.useFakeTimers();
    const realtime = memoryRealtime();
    const response = eventStream(realtime, {
      request: new Request('https://app.test/events'),
      visible: () => true,
      heartbeatSeconds: 1,
      maxSeconds: 3,
    });

    vi.advanceTimersByTime(3000);
    const text = await read(response);

    expect(text.match(/: ping\n\n/g)).toHaveLength(2);
  });
});

/** Behaves as pg-pool does where it matters: a second release throws. */
function fakePool({ failListen = 0 } = {}) {
  const queries: string[] = [];
  const notified: unknown[][] = [];
  const clients: ReturnType<typeof fakeClient>[] = [];
  let failures = failListen;
  function fakeClient() {
    const handlers = new Map<string, Set<(value: never) => void>>();
    const released: unknown[] = [];
    return {
      released,
      async query(text: string) {
        queries.push(text);
        if (text.startsWith('LISTEN') && failures > 0) {
          failures -= 1;
          throw new Error('connection lost');
        }
      },
      on(event: string, handler: (value: never) => void) {
        handlers.set(event, (handlers.get(event) ?? new Set()).add(handler));
      },
      removeListener(event: string, handler: (value: never) => void) {
        handlers.get(event)?.delete(handler);
      },
      emit(event: string, value: unknown) {
        for (const handler of handlers.get(event) ?? [])
          handler(value as never);
      },
      release(error?: unknown) {
        if (released.length) {
          throw new Error(
            'Release called on client which has already been released to the pool.'
          );
        }
        released.push(error ?? null);
      },
    };
  }
  return {
    pool: {
      connect: vi.fn(async () => {
        const client = fakeClient();
        clients.push(client);
        return client;
      }),
      async query(_text: string, values?: unknown[]) {
        notified.push(values ?? []);
      },
    },
    clients,
    queries,
    notified,
    notify(payload: string, channel = 'helpdesk_changes') {
      for (const client of clients)
        client.emit('notification', { channel, payload });
    },
    released: () => clients.reduce((n, c) => n + c.released.length, 0),
  };
}

describe('postgresRealtime', () => {
  it('publishes through NOTIFY and listens on one connection while anyone subscribes', async () => {
    const pg = fakePool();
    const realtime = postgresRealtime({ pool: pg.pool });
    const heard: RealtimeChange[] = [];

    const leave = realtime.subscribe(c => heard.push(c));
    realtime.subscribe(() => {});
    await vi.waitFor(() =>
      expect(pg.queries).toContain('LISTEN helpdesk_changes')
    );
    expect(pg.pool.connect).toHaveBeenCalledTimes(1);

    await realtime.publish(change);
    expect(pg.notified).toEqual([['helpdesk_changes', JSON.stringify(change)]]);

    pg.notify(JSON.stringify(change));
    pg.notify('not json');
    pg.notify(JSON.stringify(change), 'someone_else');
    expect(heard).toEqual([change]);
    leave();
  });

  it('gives the connection back when the last subscriber leaves', async () => {
    const pg = fakePool();
    const realtime = postgresRealtime({ pool: pg.pool });
    const leave = realtime.subscribe(() => {});
    await vi.waitFor(() =>
      expect(pg.queries).toContain('LISTEN helpdesk_changes')
    );

    leave();

    await vi.waitFor(() => expect(pg.released()).toBe(1));
    expect(pg.queries).toContain('UNLISTEN helpdesk_changes');
  });

  it('ignores an error on a connection it already gave back', async () => {
    const pg = fakePool();
    const realtime = postgresRealtime({ pool: pg.pool, retryMs: 1 });
    const leave = realtime.subscribe(() => {});
    await vi.waitFor(() =>
      expect(pg.queries).toContain('LISTEN helpdesk_changes')
    );
    leave();
    await vi.waitFor(() => expect(pg.released()).toBe(1));

    const [given] = pg.clients;
    expect(() =>
      given?.emit('error', new Error('server restart'))
    ).not.toThrow();
    expect(pg.released()).toBe(1);
    expect(pg.pool.connect).toHaveBeenCalledTimes(1);
  });

  it('gives back a connection that failed to listen, and tries again', async () => {
    const pg = fakePool({ failListen: 1 });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const realtime = postgresRealtime({ pool: pg.pool, retryMs: 1 });
    const heard: RealtimeChange[] = [];
    const leave = realtime.subscribe(c => heard.push(c));

    await vi.waitFor(() => expect(pg.pool.connect).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(
        pg.queries.filter(q => q === 'LISTEN helpdesk_changes')
      ).toHaveLength(2)
    );
    expect(pg.clients[0]?.released).toEqual([expect.any(Error)]);
    expect(pg.clients[1]?.released).toEqual([]);
    pg.clients[1]?.emit('notification', {
      channel: 'helpdesk_changes',
      payload: JSON.stringify(change),
    });
    expect(heard).toEqual([change]);
    leave();
  });

  it('reconnects once after the listening connection drops', async () => {
    const pg = fakePool();
    const realtime = postgresRealtime({ pool: pg.pool, retryMs: 1 });
    const leave = realtime.subscribe(() => {});
    await vi.waitFor(() => expect(pg.clients).toHaveLength(1));
    await vi.waitFor(() =>
      expect(pg.queries).toContain('LISTEN helpdesk_changes')
    );

    const dropped = new Error('terminated');
    pg.clients[0]?.emit('error', dropped);
    pg.clients[0]?.emit('error', dropped);

    expect(pg.clients[0]?.released).toEqual([dropped]);
    await vi.waitFor(() => expect(pg.pool.connect).toHaveBeenCalledTimes(2));
    leave();
  });
});
