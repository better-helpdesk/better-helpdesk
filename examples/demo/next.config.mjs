import { join } from 'node:path';

import { withHelpdesk } from 'better-helpdesk/next';

export default withHelpdesk({
  // Both UIs request paths with a trailing slash; without this every call
  // spends a 308 first, and cross-origin it fails the CORS preflight.
  trailingSlash: true,
  // The app lives in a workspace, so Next would guess the wrong file root.
  outputFileTracingRoot: join(import.meta.dirname, '../..'),
});
