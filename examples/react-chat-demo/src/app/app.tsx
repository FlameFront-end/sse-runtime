import type { ReactElement } from "react";
import { useState } from "react";

import { EventLog } from "../features/chat-stream/ui/event-log";
import { ChatPanel } from "../features/chat-stream/ui/chat-panel";
import { StatusSidebar } from "../features/chat-stream/ui/status-sidebar";
import { useChatStream } from "../features/chat-stream/model/use-chat-stream";
import { useTheme } from "../shared/use-theme";

const CHAT_ID = "demo-chat";
type MobileTab = "controls" | "chat" | "events";

export function App(): ReactElement {
  const stream = useChatStream(CHAT_ID);
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState<MobileTab>("chat");

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-brand">
          <span className="app-header-logo">◈</span>
          <span className="app-header-title">SSE Runtime</span>
          <span className="app-header-badge">demo</span>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <div className="app-body">
        <div className={`col col-sidebar${activeTab !== "controls" ? "" : " col--active"}`}>
          <StatusSidebar chatId={CHAT_ID} stream={stream} />
        </div>
        <div className={`col col-chat${activeTab !== "chat" ? "" : " col--active"}`}>
          <ChatPanel
            chatId={CHAT_ID}
            messages={stream.messages}
            progress={stream.progress}
            summary={stream.summary}
          />
        </div>
        <div className={`col col-events${activeTab !== "events" ? "" : " col--active"}`}>
          <EventLog entries={stream.logEntries} />
        </div>
      </div>

      <nav className="mobile-tabs" aria-label="Sections">
        <button
          type="button"
          className={`mobile-tab${activeTab === "controls" ? " mobile-tab--active" : ""}`}
          onClick={() => setActiveTab("controls")}
        >
          <SlidersIcon />
          Controls
        </button>
        <button
          type="button"
          className={`mobile-tab${activeTab === "chat" ? " mobile-tab--active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          <ChatIcon />
          Chat
        </button>
        <button
          type="button"
          className={`mobile-tab${activeTab === "events" ? " mobile-tab--active" : ""}`}
          onClick={() => setActiveTab("events")}
        >
          <ActivityIcon />
          Events
        </button>
      </nav>
    </div>
  );
}

function SunIcon(): ReactElement {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon(): ReactElement {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SlidersIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function ChatIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ActivityIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
