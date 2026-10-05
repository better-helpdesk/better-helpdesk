import { isDeepStrictEqual } from 'node:util';

import type { HelpdeskConfig } from './config';
import type { Conversation, Message } from './db/store';

export type HelpdeskEvent =
  | {
      kind: 'conversation.created';
      conversation: Conversation;
      message: Message;
    }
  | {
      kind: 'message.created';
      conversation: Conversation;
      message: Message;
      internal: boolean;
    }
  | {
      kind: 'conversation.updated';
      conversation: Conversation;
      before: Partial<Conversation>;
      agentId: string | null;
    };

export async function emit(config: HelpdeskConfig, event: HelpdeskEvent) {
  try {
    await config.onEvent?.(event);
  } catch (error) {
    console.error(`[helpdesk] onEvent ${event.kind} failed`, error);
  }
}

const TRACKED = [
  'status',
  'priority',
  'assigneeId',
  'type',
  'inbox',
  'title',
  'tags',
  'snoozedUntil',
] as const;

/** Records and reports the `patch` keys whose stored value changed; the patch itself may hold SQL such as `now()`. */
export async function emitUpdated(
  config: HelpdeskConfig,
  old: Conversation,
  updated: Conversation | null,
  patch: Partial<Conversation>,
  agentId: string | null,
  by?: 'customer'
) {
  if (!updated) return;
  const keys = Object.keys(patch) as (keyof Conversation)[];
  const before = Object.fromEntries(
    keys
      .filter(key => !isDeepStrictEqual(old[key], updated[key]))
      .map(key => [key, old[key]])
  );
  if (Object.keys(before).length === 0) return;
  await emit(config, {
    kind: 'conversation.updated',
    conversation: updated,
    before,
    agentId,
  });
  try {
    await config.db.recordEvents(
      TRACKED.filter(key => Object.hasOwn(before, key)).map(key => ({
        conversationId: updated.id,
        agentId,
        kind: key,
        data: {
          from: before[key] ?? null,
          to: updated[key] ?? null,
          ...(by && { by }),
        },
      }))
    );
  } catch (error) {
    console.error('[helpdesk] recording conversation events failed', error);
  }
}
