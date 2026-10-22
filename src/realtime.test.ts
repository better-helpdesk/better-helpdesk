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

function fakePool() {
  const queries: string[] = [];
  const notified: unknown[][] = [];
  let listener: ((m: { channel: string; payload?: string }) => void) | null =
    null;
  let released = 0;
  const client = {
    async query(text: string) {
      queries.push(text);
    },
    on(event: string, handler: unknown) {
      if (event === 'notification') listener = handler as typeof listener;
    },
    release() {
      released += 1;
    },
  };
  return {
    pool: {
      connect: vi.fn(async () => client),
      async query(_text: string, values?: unknown[]) {
        notified.push(values ?? []);
      },
    },
    queries,
    notified,
    notify(payload: string, channel = 'helpdesk_changes') {
      listener?.({ channel, payload });
    },
    released: () => released,
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
});
