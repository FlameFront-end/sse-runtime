---
"@flamefrontend/sse-runtime-react": minor
---

`useSSE` now returns `client`, `ensureOpen`, and `reconnect` alongside `status`,
`error`, `connect`, and `disconnect`, so readiness-before-action and wildcard
subscriptions are reachable without dropping down to `SSEProvider`. Add the
`useSSEAnyEvent(connection, handler)` hook for subscribing to every event
regardless of name — useful when the event discriminator lives in the payload.
