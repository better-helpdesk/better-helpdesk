---
id: ai-draft-tools
epic: host-integration
wave: backlog
size: S
title: "feat(ai): shorten, make formal and translate a draft through the AI adapter"
labels: enhancement, area: config, size: S, backlog
depends: []
better_with: []
---
**Problem**

An agent writing in German to an English customer, or trimming a long reply, leaves the composer to do it.

**Scope**

In: `POST conversations/:id/draft` gains `{ mode: "shorten" | "formal" | "translate", text }` reusing `ai.generate` with a second system prompt; three buttons shown only when `me.ai`. Out: tone presets, summaries of the thread.

**Evidence**

Intercom Copilot tone and translation; Zendesk writing tools; Libredesk editor prompts (and the HN reaction to "Add Empathy": keep it to three plain verbs).
