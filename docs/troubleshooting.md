# Troubleshooting

## Stream buffers behind a reverse proxy

**Symptom:** Events never arrive in the browser even though the server sends them. The connection appears open (`status: "open"`) but no handlers fire.

**Cause:** Nginx, Caddy, and other proxies buffer response bodies by default. SSE requires unbuffered streaming.

**Fix — Nginx:**

```nginx
location /stream {
  proxy_pass http://localhost:3000;
  proxy_buffering off;
  proxy_cache off;
  proxy_set_header Connection "";
  proxy_http_version 1.1;
}
```

**Fix — Caddy:**

```caddy
reverse_proxy /stream localhost:3000 {
  flush_interval -1
}
```

**Fix — server-side (Node.js):** call `res.flushHeaders()` immediately after setting headers, before any event data.

---

## CORS credentials missing

**Symptom:** The browser sends the SSE request without cookies or `Authorization` headers. The server sees an unauthenticated request.

**Cause:** `fetch` does not send credentials cross-origin unless explicitly configured.

**Fix:**

```ts
createSSEClient({
  key: ["chat"],
  url: "https://api.example.com/stream",
  credentials: "include", // send cookies
  headers: () => ({ Authorization: `Bearer ${getToken()}` })
});
```

The server must also respond with:

```
Access-Control-Allow-Origin: https://your-app.com  (not *)
Access-Control-Allow-Credentials: true
```

---

## Auth refresh loop

**Symptom:** `onUnauthorized` is called once, but the client immediately moves to `"error"` state without reconnecting.

**Cause 1:** `retryAfterRefresh` is not set to `true`.

```ts
auth: {
  onUnauthorized: async () => { await refresh(); },
  retryAfterRefresh: true, // ← required
}
```

**Cause 2:** `onUnauthorized` throws. Any uncaught error moves the client to `"error"`.

**Symptom:** `onUnauthorized` is called but the server still returns 401 on the second request.

**Cause:** The token was not stored before the callback resolved. Make sure `getAccessToken()` in your `headers` function reads the freshly stored value.

---

## Events arrive but handlers do not run

**Symptom:** The network tab shows SSE messages. `status` is `"open"`. But the `events` callbacks never fire.

**Cause 1:** Event name mismatch. The server sends `event: Message` (capital M) but the client registers `message` (lowercase). SSE names are case-sensitive.

**Cause 2:** The server sends data without an `event:` field. Such events have an implicit name of `"message"`.

```
data: {"text":"hello"}\n\n           ← dispatched as "message"
event: update\ndata: {"v":1}\n\n     ← dispatched as "update"
```

**Cause 3:** Payload is not valid JSON. The client tries `JSON.parse` and falls back to the raw string if parsing fails. If the handler expects an object, it will receive a string instead.

**Cause 4:** A previous event handler threw an error. Check `client.getError()` — a handler error sets the error state but does not close the stream.

---

## Duplicate connections in multiple tabs

**Symptom:** Each browser tab opens its own SSE connection to the server.

**Cause:** Coordination is not enabled.

**Fix:**

```ts
createSSEClient({
  key: ["chat", roomId], // must be identical across all tabs
  url: `/rooms/${roomId}/stream`,
  coordination: {
    enabled: true,
    mode: "single-tab"
  }
});
```

The `key` array must be structurally identical across all tabs. `["chat", "1"]` and `["chat", 1]` are treated as different keys.

Coordination requires `BroadcastChannel` and Web Locks. If either is unavailable (e.g., in a SharedWorker or older browser), the client silently falls back to an independent connection.

---

## npm package install / import issues

**`Module not found: @flamefrontend/sse-runtime-core`**

Install the core package explicitly even when using the React wrapper:

```bash
npm install @flamefrontend/sse-runtime-core @flamefrontend/sse-runtime-react
```

**Type errors after updating the package**

The React package resolves types from the core package's `dist/` folder. If you are working in a monorepo or local development setup, rebuild the core package first:

```bash
# From the monorepo root
pnpm --filter @flamefrontend/sse-runtime-core build
```

**`SSEClient` is not generic / `subscribeEvent` does not exist**

You may be importing from an older version of the package. `SSEClient<Events>` and `subscribeEvent` were introduced in version `0.2.0`. Check your installed version:

```bash
npm list @flamefrontend/sse-runtime-core
```

**Tree-shaking / bundle size**

Both packages are published as ES modules with `"sideEffects": false`. Unused exports are eliminated by any modern bundler (Vite, webpack 5, Rollup).
