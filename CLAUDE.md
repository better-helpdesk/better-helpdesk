@AGENTS.md

## Claude Code in this repository

- `.claude/settings.json` makes every `git push` and `git tag` ask first.
  That prompt is the approval gate from "Off-limits", so answer it by asking
  the maintainer, never by finding another route to the remote.
- `/release` walks a version from bump to published package. It is
  user-invoked: only the maintainer starts a release.
