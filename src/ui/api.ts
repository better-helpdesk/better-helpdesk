import { useCallback, useEffect, useRef, useState } from 'react';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly ids?: string[]
  ) {
    super(message);
  }
}

export type StreamChange = {
  conversationId: string;
  kind: 'message' | 'conversation' | 'typing';
};

export type Api = (<T>(
  path: string,
  init?: { method?: string; body?: unknown }
) => Promise<T>) & {
  /** Follows a server-sent event stream until the returned stop is called; reconnects on its own. */
  events?(path: string, onChange: (change: StreamChange) => void): () => void;
};

export function createApi(
  base: string,
  headers: () => Record<string, string> = () => ({})
): Api {
  const root = base.replace(/\/$/, '');
  const call: Api = async (path, init = {}) => {
    const response = await fetch(`${root}/${withSlash(path)}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(init.body === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        ...headers(),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(
        response.status,
        data?.error ?? response.statusText,
        data?.ids
      );
    }
    return data;
  };
  call.events = (path, onChange) =>
    followEvents(`${root}/${withSlash(path)}`, headers, onChange);
  return call;
}

/**
 * Read with fetch rather than EventSource, which cannot send the visitor and
 * identity headers a widget on another origin signs in with.
 */
function followEvents(
  url: string,
  headers: () => Record<string, string>,
  onChange: (change: StreamChange) => void
) {
  let stopped = false;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;

  const connect = async () => {
    controller = new AbortController();
    try {
      const response = await fetch(url, {
        headers: { accept: 'text/event-stream', ...headers() },
        credentials: 'same-origin',
        signal: controller.signal,
      });
      // No stream on this server, or not for this caller: polling carries on alone.
      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404
      ) {
        return;
      }
      if (!response.ok || !response.body)
        throw new Error(String(response.status));
      failures = 0;
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        let end = buffer.indexOf('\n\n');
        while (end >= 0) {
          const event = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = event
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trim())
            .join('\n');
          if (data && /^event: change$/m.test(event)) {
            try {
              onChange(JSON.parse(data) as StreamChange);
            } catch {
              // A malformed event changes nothing.
            }
          }
          end = buffer.indexOf('\n\n');
        }
      }
    } catch {
      if (stopped) return;
      failures += 1;
    }
    if (stopped) return;
    timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** failures));
  };
  void connect();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
  };
}

/**
 * Loads on mount and whenever `key` changes; polls while the page is visible,
 * or always with `whenHidden`, for what a background tab has to show.
 */
export function useResource<T>(
  load: () => Promise<T>,
  key: string,
  pollMs?: number,
  { whenHidden = false }: { whenHidden?: boolean } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  // Only the latest load may write: a slow one for an old key, or a poll that
  // overlapped a key change, would otherwise land on top of the newer data.
  const latest = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++latest.current;
    try {
      const next = await loadRef.current();
      if (request !== latest.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (request === latest.current) setError(e as Error);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the resource; a new one must reload.
  useEffect(() => {
    setData(null);
    void refresh();
  }, [key, refresh]);

  // Kept apart from loading, so a changing interval never blanks the data.
  useEffect(() => {
    if (!pollMs) return;
    const timer = setInterval(() => {
      if (whenHidden || document.visibilityState === 'visible') void refresh();
    }, pollMs);
    return () => clearInterval(timer);
  }, [pollMs, refresh, whenHidden]);

  return { data, error, refresh, setData };
}

/** Hosts with `trailingSlash` redirect bare paths, and a redirect breaks a CORS preflight. */
export function withSlash(path: string) {
  const [pathname = '', query] = path.split('?');
  const slashed = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return query === undefined ? slashed : `${slashed}?${query}`;
}

export async function uploadToStorage(
  upload: { url: string; fields: Record<string, string> },
  file: Blob
) {
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) {
    form.append(name, value);
  }
  form.append('file', file);
  const response = await fetch(upload.url, { method: 'POST', body: form });
  if (!response.ok) throw new ApiError(response.status, 'Upload failed');
}

/** Follows `path`'s event stream while `enabled`; `onChange` may change between renders. */
export function useEvents(
  api: Api,
  path: string,
  enabled: boolean,
  onChange: (change: StreamChange) => void
) {
  const listener = useRef(onChange);
  listener.current = onChange;
  useEffect(() => {
    if (!enabled || !api.events) return;
    return api.events(path, change => listener.current(change));
  }, [api, path, enabled]);
}
