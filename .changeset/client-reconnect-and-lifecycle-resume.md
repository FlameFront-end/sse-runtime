---
"@flamefrontend/sse-runtime-core": minor
---

Add `client.reconnect()` to force a fresh connection even when the client looks
`open`, resuming from the last seen event id without emitting a manual-disconnect
diagnostic. Add `attachLifecycleResume(client, options)`, a browser helper that
reconnects on `focus`, `online`, `pageshow`, and visibility changes (with
throttling and an `ensure` vs `reconnect` strategy).
