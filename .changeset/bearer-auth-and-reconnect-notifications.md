---
"@flamefrontend/sse-runtime-core": minor
---

Add two helpers that remove common boilerplate.

- `createBearerAuth(getToken, options?)` returns ready-to-spread `headers` and `auth` options for token authentication. The token provider is resolved before every connection attempt and again on `401` (so a refreshing provider recovers transparently), `Authorization` is omitted when no token is available, and the scheme and extra headers are configurable.
- `attachReconnectNotifications(client, { onReconnecting, onReconnected, onFailed })` turns raw status transitions into reconnect-lifecycle callbacks — fired only for real drops and recoveries, not the initial connect or a manual `disconnect()`. Returns a cleanup function.
  </content>
