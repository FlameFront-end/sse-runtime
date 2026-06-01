import type { ReactElement } from "react";

import { formatTime } from "../../../shared/format-time";
import type { StreamLogEntry } from "../model/chat-stream-types";

type EventLogProps = {
  readonly entries: readonly StreamLogEntry[];
};

export function EventLog({ entries }: EventLogProps): ReactElement {
  return (
    <section className="event-log" aria-label="Stream event log">
      <header className="event-log-header">
        <p className="event-log-eyebrow">SSE events</p>
        <h2 className="event-log-title">Runtime log</h2>
      </header>

      <div className="event-list">
        {entries.length === 0 ? (
          <div className="event-empty">
            <span className="event-empty-title">No events</span>
            <span className="event-empty-desc">Parsed SSE events will appear here.</span>
          </div>
        ) : (
          entries.map((entry) => <EventEntry entry={entry} key={entry.id} />)
        )}
      </div>
    </section>
  );
}

function EventEntry({ entry }: { readonly entry: StreamLogEntry }): ReactElement {
  return (
    <article className={`event-entry event-${entry.kind}`}>
      <span className="event-type-badge">{entry.kind}</span>
      <div className="event-body">
        <span className="event-title">{entry.title}</span>
        <span className="event-detail">{entry.detail}</span>
        <time className="event-time" dateTime={entry.timestamp}>
          {formatTime(entry.timestamp)}
        </time>
      </div>
    </article>
  );
}
