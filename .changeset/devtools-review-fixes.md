---
"@flamefrontend/sse-runtime-devtools": patch
---

DevTools fixes and improvements:

- Fix `events/sec` undercounting at high throughput — the rate is now measured over a 5s window of dedicated timestamps, independent of the event-log cap.
- Snapshot event payloads on arrival so later mutation of the source object in the app is no longer reflected retroactively in the log (also avoids pinning large user objects in memory).
- `Esc` no longer closes the panel while typing in the filter field.
- Cross-origin streams now show their host in the connection list, so two connections sharing a path on different hosts stay distinguishable.
- Export now reports `eventsInLog` and `truncated` instead of implying the JSON contains every event.
- Auto-scroll respects the active filter (a new event hidden by the filter no longer yanks the viewport).
- The 1s metric tick now runs only while a connection is live.
- Accessibility: focus moves into the panel on open and returns to the previously focused element on close; the resize grip is keyboard-operable (↑/↓, Shift for larger steps) with proper ARIA range attributes.
- The `connect()` action no longer leaves an unhandled rejection if the connection fails.
