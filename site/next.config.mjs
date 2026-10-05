import { join } from 'node:path';

import { withHelpdesk } from 'better-helpdesk/next';

export default withHelpdesk({
  // Both UIs request paths with a trailing slash; without this every call
  // spends a 308 first.
  trailingSlash: true,
  // The app lives in a workspace, so Next would guess the wrong file root.
  outputFileTracingRoot: join(import.meta.dirname, '..'),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The agent UI must not be framed by another site (clickjacking).
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
});
