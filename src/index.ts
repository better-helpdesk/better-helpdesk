import type { HelpdeskConfig } from './config';
import { createHandler } from './http';
import { createHelpdesk } from './service';

export type * from './config';
export {
  type AdapterInput,
  type Capabilities,
  createAdapter,
  type DatabaseAdapter,
  type FindQuery,
  type Notification,
  type OrderBy,
  type Where,
} from './db/adapter';
export {
  type Family,
  type KyselyAdapter,
  kyselyAdapter,
  mssqlAdapter,
  mysqlAdapter,
  postgresAdapter,
  type SqliteDatabaseInput,
  sqliteAdapter,
} from './db/kysely';
export { migrate } from './db/migrate';
export { helpdeskModel, type ModelName, type Row } from './db/model';
export {
  type Conversation,
  createStore,
  type HelpdeskStore,
  type Message,
} from './db/store';
export { formatReference, parseReference } from './domain';
export type { HelpdeskEvent } from './events';
export {
  type IdentityClaims,
  signIdentityToken,
  verifyIdentityToken,
} from './identity-token';
export {
  memoryRealtime,
  postgresRealtime,
  type RealtimeAdapter,
  type RealtimeChange,
} from './realtime';
export { HelpdeskError, ipBucket } from './service';

import { HelpdeskError } from './service';

export { exportConversations, importConversations } from './export';
export type {
  SlaClock,
  SlaClockFor,
  SlaTargetName,
} from './sla';

/** Builds the support instance a host mounts: `handler` serves every route under `basePath`. */
export function buildHelpdesk(config: HelpdeskConfig) {
  const support = createHelpdesk(config);
  return {
    ...support,
    handler: createHandler(support),
    /**
     * Opens a conversation as an agent does from the agent UI, in the name
     * of the agent whose host user id is `agentUserId`.
     */
    openConversation: async ({
      agentUserId,
      ...input
    }: Record<string, unknown> & { agentUserId: string }) => {
      const agent = await support.agentByUserId(agentUserId);
      if (!agent) throw new HelpdeskError(400, 'Unknown agent');
      return support.openConversation(input, agent);
    },
    /**
     * Changes a conversation as `PATCH agent/conversations/{id}` does: the
     * timeline, `onEvent` and open agent UIs all hear of it.
     */
    changeConversation: async (
      conversationId: string,
      patch: Record<string, unknown>,
      { agentUserId }: { agentUserId?: string } = {}
    ) =>
      support.changeConversation(
        await support.requireConversation(conversationId),
        patch,
        (await support.agentByUserId(agentUserId))?.id ?? null
      ),
  };
}

export type BuiltHelpdesk = ReturnType<typeof buildHelpdesk>;
