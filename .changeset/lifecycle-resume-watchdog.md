---
"@flamefrontend/sse-runtime-core": minor
---

Add a stale-stream watchdog and richer wildcard events.

- `attachLifecycleResume` gains `staleTimeoutMs`, `wakeDriftMs`, `minHiddenMs`, and `getLastActivityAt` options. When `staleTimeoutMs` or `wakeDriftMs` is set, a background watchdog recovers a connection the browser never reported as broken — a stream that went silent or whose socket died while the device slept. Wake signals (`online`, `visible`) force a resume; `focus`/`pageshow` resume only when the connection looks unhealthy.
- `SSEClient.getLastEventAt()` returns the timestamp of the most recently received event, for use as a staleness signal (and as the watchdog's default activity source).
- `SSEEventEnvelope` delivered to `subscribeAnyEvent` / `useSSEAnyEvent` now includes `raw`, the original unparsed `data` string, alongside the parsed `data`.
  </content>
