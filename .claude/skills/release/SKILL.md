---
name: release
description: Cut a better-helpdesk release, from the version bump PR to the published package and GitHub Release.
disable-model-invocation: true
---

# Releasing better-helpdesk

A release is a `vX.Y.Z` tag on `main` whose version equals `package.json`.
`.github/workflows/release.yml` does the rest: lint, tests, `pnpm pack`,
`npm publish` with provenance through trusted publishing (no token exists
anywhere), then a GitHub Release whose notes are the titles of the pull
requests merged since the previous tag.

Done means both of these hold: `npm view better-helpdesk version` prints the
new version, and `gh release view vX.Y.Z` shows notes that read as a
changelog.

Two gates are the maintainer's and never yours: merging the bump PR and
pushing the tag. Ask at each. A yes for one is not a yes for the other, and
a push of the release branch is a push too.

## 1. Is there a release here?

```sh
git fetch origin --tags
git status --short                       # must print nothing
git log --oneline "$(git describe --tags --abbrev=0 origin/main)..origin/main"
gh run list --branch main --limit 3      # the latest CI on main must be green
```

An empty log means there is nothing to release. Then read the merged PR
titles in that range (`gh pr list --state merged --base main --limit 20`):
they become the release notes word for word, so a title that does not read
as a changelog line is fixed on the PR before anything else happens.

## 2. Pick the version

Pre-1.0 semver. A breaking change to `HelpdeskConfig`, a package export, the
HTTP routes, the widget's attributes, or a migration that is not purely
additive bumps the minor; everything else bumps the patch. State the choice
and the reason.

## 3. Bump

```sh
git switch -c release-X-Y-Z origin/main
npm version X.Y.Z --no-git-tag-version
git commit -am 'chore(release): X.Y.Z'
```

Ask, then push the branch and open the PR titled `chore(release): X.Y.Z`;
the workflow recognises that title and keeps the bump out of the notes.
Watch CI with `gh pr checks <N> --watch`. The maintainer merges.

## 4. Tag

Only once the bump is on `main`:

```sh
git fetch origin
git show origin/main:package.json | grep '"version"'   # X.Y.Z
git tag vX.Y.Z origin/main
git show --no-patch --format='%h %s' vX.Y.Z             # the bump commit
```

A tag that does not equal `package.json` fails the workflow at its first
step, so the check happens before the push, not after. Ask, then
`git push origin vX.Y.Z`.

## 5. Verify

```sh
gh run watch "$(gh run list --workflow Release --limit 1 --json databaseId --jq '.[0].databaseId')"
npm view better-helpdesk version
gh release view vX.Y.Z
```

Report the version, the release URL and anything in the notes that reads
badly. A run that fails after `npm publish` has still published: re-run the
whole workflow from the Actions page rather than publishing by hand. Both
jobs skip what already exists, the npm version and the GitHub Release.
