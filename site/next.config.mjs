import { join } from 'node:path';

import { withHelpdesk } from 'better-helpdesk/next';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

export default withMDX(
  withHelpdesk({
    // Both UIs request paths with a trailing slash; without this every call
    // spends a 308 first.
    trailingSlash: true,
    // The app lives in a workspace, so Next would guess the wrong file root.
    outputFileTracingRoot: join(import.meta.dirname, '..'),
    poweredByHeader: false,
    // The site and the docs have their own root layouts, so no layout can hold a 404 for both.
    experimental: { globalNotFound: true },
    async redirects() {
      return [
        {
          source: '/quickstart',
          destination: '/docs/guides/install/',
          permanent: true,
        },
      ];
    },
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
            {
              key: 'Referrer-Policy',
              value: 'strict-origin-when-cross-origin',
            },
            // The agent UI must not be framed by another site (clickjacking).
            { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          ],
        },
      ];
    },
  })
);
