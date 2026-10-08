// Any OpenAI-compatible chat endpoint over fetch: OpenAI with the default
// base URL, or a local Ollama with OPENAI_BASE_URL=http://localhost:11434/v1.
// The Zod schema goes along as the response format.
import type { AiAdapter } from 'better-helpdesk';

export const ai: AiAdapter = {
  async generate({ system, prompt, schema }) {
    const baseUrl = (
      process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    const { $schema: _, ...jsonSchema } = schema.toJSONSchema();
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? 'ollama'}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-5',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'answer', schema: jsonSchema },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }
    const { choices } = (await response.json()) as {
      choices: {
        message: { content: string | null; refusal?: string | null };
      }[];
    };
    const message = choices[0]?.message;
    if (!message?.content) {
      throw new Error(message?.refusal ?? 'The model returned no answer');
    }
    return schema.parse(JSON.parse(message.content));
  },
};
