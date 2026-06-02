---
"@flamefrontend/sse-runtime-react": minor
---

`useSSE` now returns `role` — `"leader"`, `"follower"`, or `null` — reflecting the single-tab coordination role of the connection. Removes the need to wire up the `onCoordinationRoleChange` diagnostic just to know whether this tab owns the stream.
</content>
