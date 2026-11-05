import { useCallback, useEffect, useRef } from 'react';

type FormToken = { token: string; minSeconds: number; at: number } | null;

async function askFormToken(api: string): Promise<FormToken> {
  try {
    const response = await fetch(`${api}/widget/form/`);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      token: string;
      minSeconds: number;
    };
    return { ...data, at: Date.now() };
  } catch {
    return null;
  }
}

/** Waits out what is left of the form's minimum time, then hands over its token. */
async function ready(issued: Promise<FormToken>) {
  const token = await issued;
  const wait = token ? token.minSeconds * 1000 - (Date.now() - token.at) : 0;
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait + 50));
  return token?.token;
}

/**
 * The form token a visitor's message needs, asked for when the form mounts as
 * the widget does, so the minimum time runs while the visitor writes.
 */
export function useFormToken(api: string) {
  const issued = useRef<Promise<FormToken> | null>(null);
  useEffect(() => {
    issued.current = askFormToken(api);
  }, [api]);
  return useCallback(() => ready(issued.current ?? askFormToken(api)), [api]);
}

/**
 * Posts a message through the package's own widget API, the same call the
 * widget makes, so the site's forms land in its own inboxes.
 */
export async function sendToInbox(
  api: string,
  message: {
    inbox: string;
    name?: string;
    email: string;
    subject: string;
    body: string;
    host?: Record<string, string>;
    website?: string;
    formToken?: string;
  }
): Promise<string> {
  const { host, ...rest } = message;
  const post = (formToken: string | undefined) =>
    fetch(`${api}/widget/conversations/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'lead',
        ...rest,
        formToken,
        context: { url: location.href, host },
      }),
    });
  let response = await post(rest.formToken);
  // A page left open past a day: one more try with a token of its own.
  if (response.status === 400) {
    const error = (await response
      .clone()
      .json()
      .catch(() => null)) as {
      error?: string;
    } | null;
    if (error?.error === 'Form check failed')
      response = await post(await ready(askFormToken(api)));
  }
  if (response.status === 429) {
    throw new Error(
      'Too many messages from this address. Try again in a few minutes.'
    );
  }
  if (!response.ok) {
    throw new Error(
      'That did not go through. Check your connection and try again.'
    );
  }
  const data = (await response.json().catch(() => null)) as {
    conversation?: { reference: string } | null;
  } | null;
  return data?.conversation?.reference ?? '';
}

export const isEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
