import type { ReactElement } from "react";

import {
  describeConnectionStatus,
  formatConnectionStatus
} from "../../../shared/connection-status";
import type { ChatStreamState, FailureMode } from "../model/chat-stream-types";

const FAILURE_MODES: readonly { value: FailureMode; label: string; description: string }[] = [
  { value: "none", label: "Normal", description: "Standard stream" },
  { value: "close-after-3", label: "Close after 3", description: "Stream drops after 3 events" },
  { value: "401-once", label: "401 once", description: "First request returns 401, then retries" },
  { value: "slow-start", label: "Slow start", description: "3 s delay before first byte" },
  { value: "bad-json", label: "Bad JSON", description: "Corrupted payload on event 2" }
];

type StatusSidebarProps = {
  readonly chatId: string;
  readonly stream: ChatStreamState;
};

export function StatusSidebar({ chatId, stream }: StatusSidebarProps): ReactElement {
  return (
    <aside className="sidebar" aria-label="Conversation controls">
      <div className="sidebar-brand">
        <p className="sidebar-eyebrow">SSE Runtime</p>
        <h1 className="sidebar-title">Live support chat</h1>
      </div>

      <div className="case-card">
        <span className="case-card-label">Case ID</span>
        <span className="case-card-value">{chatId}</span>
      </div>

      <div>
        <p className="section-label" style={{ marginBottom: "8px" }}>
          Connection
        </p>
        <div className="status-panel">
          <span className={`status-dot status-${stream.status}`} />
          <div className="status-text">
            <span className="status-label">{formatConnectionStatus(stream.status)}</span>
            <span className="status-desc">{describeConnectionStatus(stream.status)}</span>
          </div>
        </div>

        {stream.coordinationRole !== null && (
          <div
            className={`role-badge role-badge-${stream.coordinationRole}`}
            style={{ marginTop: "10px" }}
          >
            <span className="role-badge-icon">
              {stream.coordinationRole === "leader" ? <LeaderIcon /> : <FollowerIcon />}
            </span>
            <span>
              Tab role: <strong>{stream.coordinationRole}</strong>
            </span>
          </div>
        )}
      </div>

      <div className="control-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={stream.isConnected}
          onClick={() => void stream.connect()}
        >
          Connect
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!stream.isConnected}
          onClick={stream.disconnect}
        >
          Disconnect
        </button>
      </div>

      <div>
        <p className="section-label" style={{ marginBottom: "8px" }}>
          Metrics
        </p>
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-value">{stream.messages.length}</span>
            <span className="metric-label">Messages</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{stream.progress}%</span>
            <span className="metric-label">Progress</span>
          </div>
        </div>
      </div>

      <div className="failure-section">
        <p className="section-label">Simulation</p>
        <div className="failure-options">
          {FAILURE_MODES.map((mode) => (
            <label
              key={mode.value}
              className={[
                "failure-option",
                stream.failureMode === mode.value ? "failure-option--active" : "",
                stream.isConnected ? "failure-option--disabled" : ""
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="radio"
                name="failure-mode"
                value={mode.value}
                checked={stream.failureMode === mode.value}
                disabled={stream.isConnected}
                onChange={() => stream.setFailureMode(mode.value)}
              />
              <div className="failure-option-body">
                <span className="failure-option-label">{mode.label}</span>
                <span className="failure-option-desc">{mode.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {stream.error ? (
        <div className="error-panel" role="alert">
          <span className="error-kind">{stream.error.kind}</span>
          <span className="error-message">{stream.error.message}</span>
        </div>
      ) : null}
    </aside>
  );
}

function LeaderIcon(): ReactElement {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function FollowerIcon(): ReactElement {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
