---
"@flamefrontend/sse-runtime-core": minor
---

Expose the coordination role on coordinated clients. A client created with `coordination: { enabled: true }` now offers `getRole()` and `subscribeRole(listener)`, reporting `"leader"` (this tab owns the real connection) or `"follower"` (this tab mirrors the leader over a `BroadcastChannel`), or `null` once disconnected. Non-coordinated clients omit both methods. This makes the leader/follower split observable without wiring up the `onCoordinationRoleChange` diagnostic.
</content>
