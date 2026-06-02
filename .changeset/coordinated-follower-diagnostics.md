---
"@flamefrontend/sse-runtime-core": minor
---

Forward `onRawEvent`, `onOpen`, and `onDisconnect` diagnostics from the
coordination leader to follower tabs, so every tab can drive logging and
lifecycle UI — not just the one holding the real connection. `RawEventDiagnosticInfo`
now carries an optional `role` (`"leader"` | `"follower"`) when coordination is
enabled. Also fixes `onParseError` not firing in coordinated clients.
