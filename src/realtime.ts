/** Something about a conversation changed; a client reloads what it shows of it. */
export type RealtimeChange = {
  conversationId: string;
  kind: 'message' | 'conversation' | 'typing';
  /** An internal note; only agents' streams carry it. */
  internal?: boolean;
};

/**
 * Carries changes from the request that made them to every open event
 * stream. `memoryRealtime()` reaches the streams of one process;
 * `postgresRealtime()` those of every process on the database.
 */
export type RealtimeAdapter = {
  publish(change: RealtimeChange): void | Promise<void>;
  /** Returns the unsubscribe. */
  subscribe(listener: (change: RealtimeChange) => void): () => void;
};

export function memoryRealtime(): RealtimeAdapter {
  const listeners = new Set<(change: RealtimeChange) => void>();
  return {
    publish(change) {
      for (const listener of listeners) listener(change);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type PgNotification = { channel: string; payload?: string };
type PgClient = {
  query(text: string, values?: unknown[]): Promise<unknown>;
  on(event: 'notification', listener: (message: PgNotification) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  release(error?: Error | boolean): void;
};
type PgPool = {
  connect(): Promise<PgClient>;
  query(text: string, values?: unknown[]): Promise<unknown>;
};

const CHANNEL = 'helpdesk_changes';

/**
 * Changes over Postgres `NOTIFY`, so a stream on one process hears a reply
 * written on another. One pooled connection listens while anyone is
 * subscribed; it is given back when the last one leaves.
 */
export function postgresRealtime({
  pool,
  retryMs = 2000,
}: {
  pool: PgPool;
  retryMs?: number;
}): RealtimeAdapter {
  const local = memoryRealtime();
  let subscribers = 0;
  let client: PgClient | null = null;
  let connecting: Promise<void> | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;

  function onNotification({ channel, payload }: PgNotification) {
    if (channel !== CHANNEL || !payload) return;
    try {
      local.publish(JSON.parse(payload) as RealtimeChange);
    } catch {
      // Not ours to understand; nothing listens for it.
    }
  }

  async function listen() {
    const next = await pool.connect();
    next.on('notification', onNotification);
    next.on('error', error => {
      // A dropped connection loses notifications until the next one listens;
      // the clients' polling covers the gap.
      next.release(error);
      if (client === next) client = null;
      if (subscribers > 0) schedule();
    });
    await next.query(`LISTEN ${CHANNEL}`);
    if (subscribers === 0) {
      next.release();
      return;
    }
    client = next;
  }

  function schedule() {
    if (retry) return;
    retry = setTimeout(() => {
      retry = null;
      ensure();
    }, retryMs);
  }

  function ensure() {
    if (client || connecting) return;
    connecting = listen()
      .catch(error => {
        console.error('[helpdesk] realtime listen failed', error);
        if (subscribers > 0) schedule();
      })
      .finally(() => {
        connecting = null;
      });
  }

  return {
    async publish(change) {
      await pool.query('SELECT pg_notify($1, $2)', [
        CHANNEL,
        JSON.stringify(change),
      ]);
    },
    subscribe(listener) {
      const unsubscribe = local.subscribe(listener);
      subscribers += 1;
      ensure();
      return () => {
        unsubscribe();
        subscribers -= 1;
        if (subscribers === 0 && client) {
          const done = client;
          client = null;
          void done
            .query(`UNLISTEN ${CHANNEL}`)
            .catch(() => undefined)
            .finally(() => done.release());
        }
      };
    },
  };
}

/** Tells the streams, never failing the request that made the change. */
export async function publishChange(
  realtime: RealtimeAdapter | undefined,
  change: RealtimeChange
) {
  if (!realtime) return;
  try {
    await realtime.publish(change);
  } catch (error) {
    console.error('[helpdesk] realtime publish failed', error);
  }
}

const encoder = new TextEncoder();

/**
 * An event stream of the changes `visible` lets through. It ends itself after
 * `maxSeconds`, which keeps a serverless function inside its limit and lets a
 * proxy recycle the connection; the client reconnects.
 */
export function eventStream(
  realtime: RealtimeAdapter,
  {
    signal,
    visible,
    heartbeatSeconds = 25,
    maxSeconds = 300,
  }: {
    signal: AbortSignal;
    visible(change: RealtimeChange): boolean | Promise<boolean>;
    heartbeatSeconds?: number;
    maxSeconds?: number;
  }
): Response {
  let stop = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const send = (text: string) => {
        if (open) controller.enqueue(encoder.encode(text));
      };
      const unsubscribe = realtime.subscribe(change => {
        void Promise.resolve(visible(change))
          .then(ok => {
            if (ok) send(`event: change\ndata: ${JSON.stringify(change)}\n\n`);
          })
          .catch(() => undefined);
      });
      const heartbeat = setInterval(
        () => send(': ping\n\n'),
        heartbeatSeconds * 1000
      );
      const end = setTimeout(() => stop(), maxSeconds * 1000);
      stop = () => {
        if (!open) return;
        open = false;
        unsubscribe();
        clearInterval(heartbeat);
        clearTimeout(end);
        signal.removeEventListener('abort', stop);
        try {
          controller.close();
        } catch {
          // Already closed by the reader.
        }
      };
      signal.addEventListener('abort', stop);
      send(`retry: 3000\n: open\n\n`);
    },
    cancel() {
      stop();
    },
  });
  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      // nginx buffers responses unless told not to, which would hold every event.
      'x-accel-buffering': 'no',
    },
  });
}
