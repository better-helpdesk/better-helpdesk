# Harbor, a better-helpdesk demo

A pretend shipping product with the package installed the way the README
describes it: one route handler, the agent UI at `/helpdesk`, the widget in the
corner. Use it to see what the thing looks like, and to find out what an
upgrade of Next.js breaks.

## Run it

```sh
docker run --rm -p 5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=helpdesk_demo postgres:18-alpine
```

Then, from the repository root:

```sh
pnpm install
cp examples/demo/.env.example examples/demo/.env.local
pnpm --filter better-helpdesk-demo db:migrate
pnpm --filter better-helpdesk-demo seed
pnpm --filter better-helpdesk-demo dev
```

`seed` writes a dozen invented conversations across both inboxes, and does
nothing once the database has handed out a reference.

## What to try

1. Open `http://localhost:3000`, send a message from the launcher, switch to
   Rowan and answer it from the inbox.
2. Press "Try the broken button", then report a bug from the launcher. The
   form lists the error it caught; the conversation shows it beside the URL,
   viewport and app version. `next dev` puts its error overlay over the page
   too; close it and carry on.
3. Open HRB-1000 as Rowan. The company card shows Brightline's plan and usage,
   which `resolveContext` in `lib/helpdesk.ts` returns.
4. Look at the rows behind the inbox, in your own database:

   ```sh
   psql postgres://postgres@localhost:5432/helpdesk_demo -c \
     "select number, inbox, type, status, subject
        from helpdesk.conversation order by created_at desc limit 5"
   ```

Emails are printed to the terminal rather than sent — look for
`[helpdesk email]` when a receipt or an agent notification goes out.

## What it is wired to

`pnpm install` links the package from the repository root, so the app compiles
the package's TypeScript through `transpilePackages` and your edits to `src/`
reload here. That is the opposite of what a published install does, which is
why CI builds this same app against the packed tarball as well.

Two consequences of the link worth knowing:

- `better-helpdesk/widget.js`, the standalone script for pages that are not
  React, only exists in the published package. The demo uses the React widget.
- The app is excluded from the root `tsconfig.json` and from
  `pnpm run lint`'s type check; `next build` type-checks it instead.

## On CI

The `example` job in `.github/workflows/ci.yml` copies this app out of the
repository, installs the packed tarball into the copy with npm, builds it and
then uses it: a widget session, the agent UI, and one conversation written to
Postgres. It runs on the current major of Next.js and the previous one for
every pull request, and on `next@canary` every Monday, where a failure is news
rather than a blocked merge.

Next.js 15 cannot drive the TypeScript 7 compiler, so that leg of the matrix
installs TypeScript 6 over this app's own devDependency.

## Three things it deliberately gets wrong

- **Identity is a cookie.** `lib/helpdesk.ts` hands anyone who sets
  `demo-role=agent` the whole inbox. The module refuses to load under
  `NODE_ENV=production` unless `DEMO_UNSAFE_AUTH=1` says you meant it.
- **No storage, no mail, no jobs.** Attachments, outbound email and scheduled
  work are all optional in `HelpdeskConfig` and all left out.
- **`DEMO_URL` must match the origin you browse.** The handler refuses
  cross-origin mutations by comparing against `adminUrl`, so a mismatch turns
  every reply into a 403.
