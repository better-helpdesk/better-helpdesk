# better-helpdesk

A support inbox, ticketing and lightweight CRM that mounts into your app: one
route handler, a React agent UI, and an embeddable widget. Data lives in its
own `helpdesk` schema in your Postgres.

## Install

```sh
npm install better-helpdesk pg react react-dom
HELPDESK_DATABASE_URL=postgres://… npx better-helpdesk-migrate
```

`better-helpdesk-migrate` uses one connection and can run in your release step.

## Mount the handler

```ts
// app/api/helpdesk/[...slug]/route.ts (Next.js; any Request → Response server works)
import { buildHelpdesk, postgresAdapter } from 'better-helpdesk';
import pg from 'pg';

const helpdesk = buildHelpdesk({
  db: postgresAdapter({ pool: new pg.Pool({ connectionString: process.env.HELPDESK_DATABASE_URL }) }),
  referencePrefix: 'ACME',
  adminUrl: 'https://app.example.com/helpdesk/',
  inboxes: { support: {}, sales: { public: true, allowedOrigins: ['https://www.example.com'] } },
  identify: async request => {
    // Your session → { user, orgs, isAgent }, or null for anonymous visitors.
    return null;
  },
});

const handle = (request: Request) => helpdesk.handler(request);
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE, handle as OPTIONS };
```

Wrap your Next config with `withHelpdesk` from `better-helpdesk/next`.
Everything else in `HelpdeskConfig` (storage, email, inbound email, AI, help
search, jobs) is optional; call `helpdesk.runJobs()` on a schedule or POST
`{basePath}/jobs` with `jobsSecret`.

When someone stops being an agent in your app, call
`helpdesk.removeAgent(user.id)`: they stop getting agent emails until they
next open the agent UI as an agent. Agents can also remove each other under
Settings.

## Agent UI

```tsx
'use client';
import { HelpdeskAdmin } from 'better-helpdesk/admin';

export default () => <HelpdeskAdmin api="/api/helpdesk" basePath="/helpdesk" locale="en" />;
```

## Widget

In React:

```tsx
import { HelpdeskWidget } from 'better-helpdesk/widget';

<HelpdeskWidget inbox="support" locale="en" />;
```

On any page, serve `better-helpdesk/widget.js` (a self-contained script)
and load it:

```html
<script src="/helpdesk/widget.js" data-api="https://app.example.com/api/helpdesk" data-inbox="sales" async></script>
```

The script brings only the widget it creates to life; a `<helpdesk-widget>`
already in the page's markup stays inert. Without `data-api` it talks to
`/api/helpdesk` on the origin the script was loaded from.

The widget requests paths with a trailing slash. On another origin, a host
that redirects them (Next.js without `trailingSlash: true`) fails the CORS
preflight.

### Signed-in users on another origin

When the widget runs on an origin where `identify` cannot see your session,
your backend signs an HS256 JWT with `identityTokenSecret` and the page passes
it as `identity-token` (`identityToken` in React):

```ts
import { signIdentityToken } from 'better-helpdesk';

signIdentityToken(
  { sub: user.id, email: user.email, email_verified: true, name: user.name, orgs: [{ id: org.id, name: org.name }] },
  process.env.HELPDESK_IDENTITY_SECRET,
  { expiresInSeconds: 3600 }
);
```

Any JWT library works: `sub` and `exp` are required. A forged or expired token
is refused with 401, and a token never grants the agent UI.

## Theming

Both UIs read CSS custom properties set on an ancestor, so they inherit into
the widget's shadow root. Shared: `--helpdesk-font`, `-bg`, `-fg`, `-muted`,
`-border`, `-subtle`, `-accent`, `-accent-hover`, `-accent-fg`, `-focus`,
`-danger`, `-radius`. The widget adds `--helpdesk-launcher-bg`/`-fg`,
`--helpdesk-panel-header-bg`/`-fg` (both default to the accent),
`--helpdesk-panel-border` and `--helpdesk-offset-bottom`; the agent UI adds
`--helpdesk-header-bg` (table heads and avatars), `--helpdesk-note`,
`--helpdesk-note-border` and `--helpdesk-warning`.

For a dark theme, set the panel header too: a light accent reads well on
buttons and links, but not as the header's background. Without variables,
`theme="auto"` on the widget follows the OS.

## Development

```sh
pnpm install
pnpm lint
pnpm test
TEST_DATABASE_URL=postgres://postgres@localhost:5432/db pnpm test:integration
```

`pnpm lint` is Biome plus `tsc --noEmit`, and CI runs it first. Integration
tests create a `helpdesk_test` database next to the one the URL names.
Releases publish from a `v*` tag whose version matches `package.json`.

[`examples/demo`](examples/demo) is a Next.js app with all of the above
installed — somewhere to see it work, and what CI builds against the packed
tarball on the current and the previous major of Next.js, and against
`next@canary` once a week.

## License

MIT
