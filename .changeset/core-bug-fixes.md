---
"@flamefrontend/sse-runtime-core": patch
---

Fix a set of correctness bugs across the core runtime:

- **Coordination: seamless failover.** Promoting a follower to leader no longer flashes every tab to a disconnected status, and a follower's error state is now cleared when the leader recovers instead of sticking forever.
- **Coordination: resumption on handoff.** A follower promoted to leader resumes the stream from the last seen `Last-Event-ID` instead of restarting it.
- **Coordination: lifecycle safety.** Queued follower tasks scheduled before `disconnect()` can no longer dispatch events or resurrect state after teardown.
- **Heartbeat.** Slow event handlers no longer count against the heartbeat budget, preventing spurious heartbeat timeouts.
- **Compatibility.** Added a fallback for runtimes without `AbortSignal.any` (Safari < 17.4, Node < 20.3).
- **Status.** The client now reports `reconnecting` while an auth refresh is in flight, and `connect()` respects `enabled: false`.
- **Parser.** `id` fields containing a NULL character and `retry` fields with non-ASCII digits are ignored per the SSE spec.
