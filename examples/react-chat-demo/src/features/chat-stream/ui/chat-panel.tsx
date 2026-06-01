import type { ReactElement } from "react";

import { formatTime } from "../../../shared/format-time";
import type { ChatMessage } from "../model/chat-stream-types";

type ChatPanelProps = {
  readonly chatId: string;
  readonly messages: readonly ChatMessage[];
  readonly progress: number;
  readonly summary: string;
};

export function ChatPanel({ chatId, messages, progress, summary }: ChatPanelProps): ReactElement {
  return (
    <section className="chat-panel" aria-label="Live chat">
      <header className="chat-header">
        <div className="chat-header-top">
          <div>
            <p className="chat-eyebrow">Case #{chatId}</p>
            <h2 className="chat-title">Customer onboarding</h2>
          </div>
          <div className="progress-block" aria-label={`Stream progress ${progress}%`}>
            <span className="progress-pct">{progress}%</span>
            <div className="progress-track">
              <div
                className={`progress-fill${progress === 100 ? " progress-bar-full" : ""}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="message-list">
        {messages.length === 0 ? (
          <EmptyMessages />
        ) : (
          messages.map((message) => <ChatBubble key={message.id} message={message} />)
        )}
      </div>

      <footer className="summary-footer">
        <p className="summary-label">Summary</p>
        <p className="summary-text">{summary}</p>
      </footer>
    </section>
  );
}

function EmptyMessages(): ReactElement {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <span className="empty-title">No messages yet</span>
      <span className="empty-desc">
        Connect to the mock SSE endpoint to start receiving events.
      </span>
    </div>
  );
}

function ChatBubble({ message }: { readonly message: ChatMessage }): ReactElement {
  return (
    <article className="message">
      <div className="message-header">
        <span className="message-author">{message.author}</span>
        <time className="message-time" dateTime={message.timestamp}>
          {formatTime(message.timestamp)}
        </time>
      </div>
      <p className="message-text">{message.text}</p>
    </article>
  );
}
