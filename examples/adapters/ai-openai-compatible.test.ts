import { afterEach, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { ai } from './ai-openai-compatible';

const triage = z.object({
  type: z.string(),
  priority: z.number(),
  title: z.string(),
});

function modelAnswers(status: number, body: unknown) {
  const fetch = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function sent(fetch: ReturnType<typeof vi.fn>) {
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  return { url, init, body: JSON.parse(init.body as string) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('asks the endpoint for the schema and returns the parsed answer', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('OPENAI_MODEL', 'gpt-5-mini');
  const fetch = modelAnswers(200, {
    choices: [
      {
        message: {
          content: '{"type":"bug","priority":2,"title":"Export is empty"}',
        },
      },
    ],
  });

  const result = await ai.generate({
    system: 'You triage support conversations.',
    prompt: 'Customer: the CSV export of last month is empty.',
    schema: triage,
  });

  expect(result).toEqual({
    type: 'bug',
    priority: 2,
    title: 'Export is empty',
  });
  const { url, init, body } = sent(fetch);
  expect(url).toBe('https://api.openai.com/v1/chat/completions');
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer sk-test');
  expect(body.model).toBe('gpt-5-mini');
  expect(body.messages).toEqual([
    { role: 'system', content: 'You triage support conversations.' },
    {
      role: 'user',
      content: 'Customer: the CSV export of last month is empty.',
    },
  ]);
  expect(body.response_format.type).toBe('json_schema');
  expect(body.response_format.json_schema.schema).toMatchObject({
    type: 'object',
    properties: {
      type: { type: 'string' },
      priority: { type: 'number' },
      title: { type: 'string' },
    },
    required: ['type', 'priority', 'title'],
  });
  expect(body.response_format.json_schema.schema.$schema).toBeUndefined();
});

test('talks to a local Ollama when the base URL says so', async () => {
  vi.stubEnv('OPENAI_BASE_URL', 'http://localhost:11434/v1/');
  const fetch = modelAnswers(200, {
    choices: [
      {
        message: {
          content: '{"type":"question","priority":3,"title":"Billing"}',
        },
      },
    ],
  });

  await ai.generate({ system: 's', prompt: 'p', schema: triage });

  expect(sent(fetch).url).toBe('http://localhost:11434/v1/chat/completions');
});

test('throws on a refusal, an answer outside the schema, or an error status', async () => {
  modelAnswers(200, {
    choices: [{ message: { content: null, refusal: 'No.' } }],
  });
  await expect(
    ai.generate({ system: 's', prompt: 'p', schema: triage })
  ).rejects.toThrow('No.');

  modelAnswers(200, { choices: [{ message: { content: '{"type":"bug"}' } }] });
  await expect(
    ai.generate({ system: 's', prompt: 'p', schema: triage })
  ).rejects.toThrow();

  modelAnswers(429, { error: { message: 'Rate limit reached' } });
  await expect(
    ai.generate({ system: 's', prompt: 'p', schema: triage })
  ).rejects.toThrow('429');
});
