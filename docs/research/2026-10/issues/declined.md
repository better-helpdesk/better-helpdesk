## Considered and declined

Each was proposed by at least one report. The reason is the engineering verdict; "later" means it returns when a design partner asks.

- **A realtime adapter (SSE, Pusher, WebSockets).** One implementation (polling at 5 and 10 seconds) does not earn an interface. The seam, when a host brings a transport, is `useResource`'s `refresh` and a `publish()` next to `emit()`. Nothing else needs to know.
- **A ⌘K command palette.** Six sections and three filters do not need one; the UX review reached the same verdict. Shortcuts and a `?` sheet instead.
- **Round-robin auto-assignment.** A README recipe on the events hook (`conversation.created` → `store.updateConversation` over `store.listAgents()` filtered by `awayUntil`); "assign to me" is the `a` key.
- **Host-defined triage rules in config.** A rules DSL with no UI is the events hook with a worse interface. Recipe instead.
- **SQL views for reporting.** A view pins columns; every later column change on `conversation` fails until the view is dropped. Three documented queries cost nothing; the overview page comes later.
- **Canned replies that also set tags or status.** "Send and resolve" exists; a second way to set tags is a second way.
- **A held list for inbound mail that fails DKIM.** Unverified mail already never threads into an existing conversation and lands as a new one from an unverified contact, which is the safe default.
- **A bounce line under a message.** Bounces arrive at the host's provider; the library sees `send()` resolve. If asked: `store.recordEvent` exposed for the host to call.
- **Hiding the AI controls when no adapter is configured.** Already the case (`me.ai` gates the draft button; suggestions exist only when the adapter enqueued triage).
- **Custom conversation attributes with "required on resolve".** Tags and `context.host` cover the two partner cases known; "required on resolve" is a rule engine.
- **Admin dark mode as a feature.** Dark already follows the host's tokens; the derived note surface lands with the radii fix.
- **In-app notifications now.** Email, counts and unread rows cover one to ten agents; written up in the backlog for after mentions.
- **Everything in the non-goals list**: social channels, a help-centre CMS, an AI that answers customers, a rule builder, an SLA engine, roles beyond `isAgent`, multi-brand, campaigns and surveys, own login, hosted mode or relay, API tokens, a mobile app, a second process, per-seat pricing or any gated feature, and the words "live chat".
