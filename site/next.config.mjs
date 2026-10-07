import { join } from 'node:path';

import { withHelpdesk } from 'better-helpdesk/next';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// Docs pages that moved when the sidebar went to topics; old links keep working.
const moved = {
  'guides/install': 'installation',
  'concepts/how-it-works': 'how-it-works',
  'concepts/vocabulary': 'vocabulary',
  'guides/databases': 'database/connect',
  'guides/own-adapter': 'database/own-adapter',
  'guides/reporting': 'database/reporting',
  'reference/database': 'database/tables',
  'guides/sign-in': 'identity/sign-in',
  'guides/identity-token': 'identity/other-origin',
  'concepts/identity': 'identity/trust',
  'guides/widget': 'widget/add',
  'guides/support-page': 'widget/support-page',
  'reference/widget': 'widget/reference',
  'guides/inboxes': 'inbox/setup',
  'guides/team': 'inbox/team',
  'guides/blocking': 'inbox/blocking',
  'guides/attachments': 'inbox/attachments',
  'reference/inboxes': 'inbox/inboxes',
  'reference/admin': 'inbox/agent-ui',
  'guides/email': 'email/send',
  'guides/inbound-email': 'email/receive',
  'reference/emails': 'email/messages',
  'guides/ai': 'ai/suggestions',
  'guides/help-search': 'ai/help-search',
  'guides/own-code': 'app/own-code',
  'guides/events': 'app/react-to-events',
  'guides/crm': 'app/crm',
  'reference/events': 'app/events',
  'guides/theming': 'customize/theming',
  'guides/languages': 'customize/languages',
  'reference/strings': 'customize/strings',
  'guides/production': 'operations/production',
  'guides/jobs': 'operations/jobs',
  'guides/switching': 'operations/switching',
  'concepts/security': 'operations/security',
  'reference/cli': 'operations/cli',
};

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
          destination: '/docs/installation/',
          permanent: true,
        },
        ...Object.entries(moved).map(([from, to]) => ({
          source: `/docs/${from}`,
          destination: `/docs/${to}/`,
          permanent: true,
        })),
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
