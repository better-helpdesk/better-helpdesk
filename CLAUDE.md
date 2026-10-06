@AGENTS.md

## Claude Code in this repository

- `.claude/settings.json` makes every `git tag` ask first. That prompt is
  the approval gate for a tag from "Off-limits", so answer it by asking the
  maintainer, never by finding another route to the remote. A push to `main`
  has no prompt and needs the maintainer's approval all the same.
- `/release` walks a version from bump to published package. It is
  user-invoked: only the maintainer starts a release.
