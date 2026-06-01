---
"@flamefrontend/sse-runtime-core": minor
"@flamefrontend/sse-runtime-react": minor
---

Add production-readiness contracts: connection readiness API, open timeout, custom retry policy, and rich diagnostics.

**New: `ensureOpen({ timeout? })`** on `SSEClient` — resolves `true` when the stream is open, `false` on terminal failure, and rejects if the optional timeout expires. Starts connecting automatically if the client is idle. Safe to call concurrently; all callers share the same wait.

**New: `openTimeout`** option — abort the HTTP connection attempt if the server does not respond within the given number of milliseconds. Works with `reconnect` so timed-out attempts are retried normally.

**New: `retry`** option (`RetryPolicyOptions`) — per-error `shouldRetry` predicate and `getDelay` function. `maxRetries` from `reconnect` is always enforced as a hard cap; `shouldRetry` is an additional per-error filter applied within that cap.

**New diagnostics callbacks** on `DiagnosticsOptions`:

- `onOpen({ url })` — fires when the HTTP response is accepted and the stream starts.
- `onDisconnect({ url, reason })` — fires on any disconnect with reason `"manual"`, `"error"`, or `"stream-ended"`.
- `onRawEvent(info)` — fires for every parsed SSE event before handlers run; carries the raw data string, id, retry, timestamp, and connection key.
- `onParseError({ error, eventName })` — fires when a JSON payload for a named subscriber cannot be parsed.

**React adapter parity** — `heartbeat`, `diagnostics`, `retry`, and `openTimeout` are now correctly forwarded through `createReactClientOptions` with live getter proxies so callback identity changes do not require client recreation.

**Internal improvements:**

- `combineSignals` extracted to a shared utility (`utils/combine-signals.ts`), removing a duplicate between the transport and client layers.
- `ensureOpen` logic extracted to `buildEnsureOpen` helper, shared between the local and coordinated client implementations.
- Coordinated client `disconnect()` always fires `onDisconnect("manual")` regardless of tab role; the inner leader engine no longer double-fires it.
