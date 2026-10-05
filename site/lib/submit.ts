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
  }
): Promise<string> {
  const { host, ...rest } = message;
  const response = await fetch(`${api}/widget/conversations/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'lead',
      ...rest,
      context: { url: location.href, host },
    }),
  });
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
