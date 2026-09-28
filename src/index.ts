import type { HelpdeskConfig } from './config';
import { createHandler } from './http';
import { createHelpdesk } from './service';

export type * from './config';
export { type HelpdeskStore, postgresAdapter } from './db/store';
export { formatReference, parseReference } from './domain';
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
