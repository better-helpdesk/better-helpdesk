import { isDeepStrictEqual } from 'node:util';

import type { HelpdeskConfig, ResolvedConfig } from './config';
import type { Conversation, Message } from './db/store';
import { publishChange } from './realtime';

export type HelpdeskEvent =
  | {
      kind: 'conversation.created';
      conversation: Conversation;
      message: Message;
    }
  | {
      /** A share of a service-level target has passed, or the target was missed. */
      kind: 'sla.warning' | 'sla.breach';
      conversation: Conversation;
      target: 'response' | 'resolution';
      due: Date;
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
  await publishChange(config.realtime, {
    conversationId: event.conversation.id,
    kind: event.kind === 'message.created' ? 'message' : 'conversation',
    ...(event.kind === 'message.created' &&
      event.internal && { internal: true }),
  });
}

const TRACKED = [
  'status',
  'priority',
  'tier',
  'assigneeId',
  'type',
  'inbox',
  'title',
  'tags',
  'snoozedUntil',
  'rating',
] as const;

/** Records and reports the `patch` keys whose stored value changed. */
export async function emitUpdated(
  config: ResolvedConfig,
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
    await config.store.recordEvents(
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
