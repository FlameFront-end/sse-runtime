---
"@flamefrontend/sse-runtime-core": minor
"@flamefrontend/sse-runtime-react": minor
"@flamefrontend/sse-runtime-devtools": minor
---

Silent-stream recovery: detect and recover "open but silent" SSE connections where the socket stays open but stops delivering data (network/VPN switches, device sleep, throttled connections).

- **core**: track byte-level transport activity (every chunk, including heartbeat comments) and expose `getLastActivityAt`/`subscribeActivity`. New `ensureHealthy({ staleAfter, timeout, reason })` reconnects an open-but-stale transport before resolving, so callers awaiting a response over SSE don't lose events on a dead stream. New recovery lifecycle events (`requested`/`started`/`succeeded`/`failed`) via `getLastRecovery`/`subscribeRecovery`, with a unified phase sequence across local and coordinated clients. `reconnect()` now accepts an optional `{ reason, timeout }`. Across single-tab coordination, activity and recovery are forwarded to followers, and a follower can request a leader reconnect and await acknowledgement (with request coalescing and timeout/cancellation handling). `attachLifecycleResume` measures staleness against `getLastActivityAt` and threads a reason through reconnect triggers.
- **react**: `useSSE` exposes `ensureHealthy`, and `reconnect` accepts the optional `{ reason, timeout }` options.
- **devtools**: surface last activity and recovery state, an "Open / silent" warning (configurable via `silentTimeoutMs`), and a manual reconnect button.

Note: subscribers to recovery events now observe an explicit `requested` phase before `started` on a direct `reconnect()` call.
