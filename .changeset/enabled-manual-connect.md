---
"@flamefrontend/sse-runtime-core": patch
"@flamefrontend/sse-runtime-react": patch
---

Fix `enabled: false` disabling the imperative API. Previously a client created with `enabled: false` had `connect()` and `ensureOpen()` permanently no-op (status stuck at `idle`), so a manual "Connect" button could never open the stream.

`enabled` now only controls whether the React hook auto-connects on mount (matching the `enabled` semantics of libraries like React Query). The imperative `connect()`, `disconnect()`, and `ensureOpen()` work regardless of `enabled`; `enabled: false` still seeds the initial status as `idle` and the hook still skips auto-connect.
