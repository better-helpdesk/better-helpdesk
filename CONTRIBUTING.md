# Contributing to Better Helpdesk

Thank you for helping. This page is the short version for people;
[`AGENTS.md`](AGENTS.md) is the full engineering guide, and
[`CONTEXT.md`](CONTEXT.md) has the vocabulary the code uses. Read the first
entry of `CONTEXT.md` before anything else: an *agent* here is a support team
member, never an AI.

## Before you write code

- **Start from an issue.** Every pull request links one. If there is none for
  your change, open it first and say what you want to do, so nobody spends a
  weekend on something that cannot be merged.
- **Claim it.** Comment on the issue that you are working on it. Issues
  labelled `good first issue` are small and well described; `help wanted`
  ones are larger.
- **Questions** go to
  [GitHub Discussions](https://github.com/better-helpdesk/better-helpdesk/discussions),
  not to issues.

## Setup

You need Node 22.19 or newer and pnpm.

```sh
pnpm install --filter better-helpdesk --frozen-lockfile
pnpm lint                     # Biome, then tsc --noEmit
pnpm test                     # unit tests
TEST_DB=sqlite pnpm test:integration
```

`--filter better-helpdesk` skips the demo app's Next.js download; drop it if
you want to run `examples/demo`. The SQLite integration suite runs
in-process, so there is no database to start.

## Integration tests on the other databases

`pnpm test:integration` without `TEST_DB` runs Postgres, SQLite and the
in-memory example adapter. Postgres needs a server:

```sh
docker run -d --name helpdesk-pg -p 5432:5432 \
  -e POSTGRES_DB=db -e POSTGRES_HOST_AUTH_METHOD=trust postgres:18-alpine
TEST_DATABASE_URL=postgres://postgres@localhost:5432/db pnpm test:integration
```

The tests create a `helpdesk_test` database next to the one the URL names.

If your change touches the store (`src/db/`) or the schema, also run MySQL and
SQL Server, which the suite picks up when their URLs are set:

```sh
docker run -d --name helpdesk-mysql -p 3306:3306 \
  -e MYSQL_ALLOW_EMPTY_PASSWORD=yes mysql:8.4
docker run -d --name helpdesk-mssql -p 1433:1433 -e ACCEPT_EULA=Y \
  -e 'MSSQL_SA_PASSWORD=Local-Only-1!' mcr.microsoft.com/mssql/server:2022-latest

TEST_DATABASE_URL=postgres://postgres@localhost:5432/db \
TEST_MYSQL_URL=mysql://root@127.0.0.1:3306/ \
TEST_MSSQL_URL='mssql://sa:Local-Only-1!@localhost:1433/' \
pnpm test:integration
```

## What green means

CI must be green before a pull request is reviewed. That is:

- `pnpm lint`
- `pnpm test`, the unit tests
- `pnpm test:integration`, on every database
- the smoke test: `pnpm pack`, then install the tarball outside the repository
  and import it
- the demo build, against the packed tarball on the current and the previous
  Next.js major

Tests check outcomes (the response, the rows in the database, the rendered
output), not which functions were called.

## Commits and pull requests

Commit messages and pull request titles use the conventional form the
history uses: `fix(widget): …`, `feat(admin): …`, `docs(readme): …`. Write
the subject as the behaviour change.

Pull request titles become the release notes, so write one that reads as a
changelog line. Put `Closes #<issue>` in the description.

A change to an option, route, event, prop or column updates its page under
`site/content/docs/` in the same pull request. A new user-facing string needs
both its English and its German text in `src/ui/i18n.ts`.

## What will not be merged

The architecture is settled; extend it rather than replace it. These are out
of scope, however well made:

- Anything that makes Better Helpdesk run on its own: a standalone server, a
  Docker image beside the app, a hosted mode, its own login or its own
  database. It is a library the host app mounts.
- A second ORM or query layer next to Kysely.
- A new runtime dependency without a stated reason in the pull request and an
  MIT-compatible licence (MIT, BSD, Apache 2.0, ISC).
- Changes to the CI, release or npm publishing setup that a maintainer has
  not agreed to first.
- Secrets or tokens anywhere in the repository.
- Real customer data in tests, fixtures, issues or pull requests. Use invented
  people on `.test` domains, as `test/harness.ts` does.

## Security

Do not report a vulnerability in a public issue. Use
[a private security advisory](https://github.com/better-helpdesk/better-helpdesk/security/advisories/new)
instead.
