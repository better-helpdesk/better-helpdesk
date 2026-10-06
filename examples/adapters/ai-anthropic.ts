// Structured outputs: the Zod schema the package passes constrains the answer,
// and `schema.parse` throws on a refusal or a cut-off reply.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AiAdapter } from 'better-helpdesk';

const anthropic = new Anthropic();

export const ai: AiAdapter = {
  async generate({ system, prompt, schema }) {
    const response = await anthropic.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: zodOutputFormat(schema) },
    });
    return schema.parse(response.parsed_output);
  },
};
