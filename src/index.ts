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
  kyselyAdapter,
  postgresAdapter,
  type SqliteDatabaseInput,
  sqliteAdapter,
} from './db/kysely';
export { migrate } from './db/migrate';
export { helpdeskModel } from './db/model';
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
export { HelpdeskError } from './service';

/** Builds the support instance a host mounts: `handler` serves every route under `basePath`. */
export function buildHelpdesk(config: HelpdeskConfig) {
  const support = createHelpdesk(config);
  return { ...support, handler: createHandler(support) };
}

export type BuiltHelpdesk = ReturnType<typeof buildHelpdesk>;
