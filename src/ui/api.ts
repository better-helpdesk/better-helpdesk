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

export type Api = <T>(
  path: string,
  init?: { method?: string; body?: unknown }
) => Promise<T>;

export function createApi(
  base: string,
  headers: () => Record<string, string> = () => ({})
): Api {
  const root = base.replace(/\/$/, '');
  return async (path, init = {}) => {
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
}

/** Loads on mount and whenever `key` changes; polls while the page is visible. */
export function useResource<T>(
  load: () => Promise<T>,
  key: string,
  pollMs?: number
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
      if (document.visibilityState === 'visible') void refresh();
    }, pollMs);
    return () => clearInterval(timer);
  }, [pollMs, refresh]);

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
