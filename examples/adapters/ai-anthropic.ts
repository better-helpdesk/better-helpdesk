// Structured output through a forced tool call; the Zod schema the package
// passes becomes the tool's input schema and checks the answer.
import Anthropic from '@anthropic-ai/sdk';
import type { AiAdapter } from 'better-helpdesk';
import { z } from 'zod';

const anthropic = new Anthropic();

export const ai: AiAdapter = {
  async generate({ system, prompt, schema }) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5-5',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          name: 'answer',
          input_schema: z.toJSONSchema(schema) as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'answer' },
    });
    const call = response.content.find(block => block.type === 'tool_use');
    return schema.parse(call?.input);
  },
};
