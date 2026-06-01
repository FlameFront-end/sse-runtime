import { useSSE } from "@flamefrontend/sse-runtime-react";
import { useMemo, useState } from "react";

import type {
  ChatEvents,
  ChatMessage,
  ChatStreamState,
  CoordinationRole,
  FailureMode,
  StreamLogEntry
} from "./chat-stream-types";

const MAX_MESSAGES = 8;
const MAX_LOG_ENTRIES = 12;
const INITIAL_SUMMARY = "Waiting for the stream to start.";

export function useChatStream(chatId: string): ChatStreamState {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState(INITIAL_SUMMARY);
  const [logEntries, setLogEntries] = useState<readonly StreamLogEntry[]>([]);
  const [failureMode, setFailureMode] = useState<FailureMode>("none");
  const [coordinationRole, setCoordinationRole] = useState<CoordinationRole>(null);

  const streamUrl =
    failureMode === "none"
      ? `/api/chats/${chatId}/stream`
      : `/api/chats/${chatId}/stream?failure=${failureMode}`;

  const connection = useSSE<ChatEvents>({
    key: ["chat", chatId],
    url: streamUrl,
    enabled: false,
    events: {
      message: (message) => {
        setMessages((currentMessages) => [...currentMessages, message].slice(-MAX_MESSAGES));
        pushLogEntry({
          id: message.id,
          kind: "message",
          title: `${message.author} sent a message`,
          detail: message.text,
          timestamp: message.timestamp
        });
      },
      progress: (nextProgress) => {
        setProgress(nextProgress.value);
        pushLogEntry({
          id: `progress-${nextProgress.value}-${Date.now()}`,
          kind: "progress",
          title: nextProgress.label,
          detail: `${nextProgress.value}% complete`,
          timestamp: new Date().toISOString()
        });
      },
      done: (done) => {
        setSummary(done.summary);
        pushLogEntry({
          id: `done-${Date.now()}`,
          kind: "done",
          title: "Conversation summary is ready",
          detail: done.summary,
          timestamp: new Date().toISOString()
        });
      }
    },
    reconnect: {
      enabled: true,
      maxRetries: 5,
      minDelay: 800,
      maxDelay: 6000
    },
    coordination: {
      enabled: true,
      mode: "single-tab"
    },
    auth: {
      onUnauthorized: async () => undefined,
      retryAfterRefresh: true
    },
    diagnostics: {
      onCoordinationRoleChange: ({ role }) => {
        setCoordinationRole(role);
      }
    }
  });

  const isConnected = useMemo(
    () =>
      connection.status === "connecting" ||
      connection.status === "open" ||
      connection.status === "reconnecting",
    [connection.status]
  );

  return {
    status: connection.status,
    error: connection.error,
    messages,
    progress,
    summary,
    logEntries,
    isConnected,
    coordinationRole,
    failureMode,
    setFailureMode,
    connect: connection.connect,
    disconnect: connection.disconnect
  };

  function pushLogEntry(entry: StreamLogEntry): void {
    setLogEntries((currentEntries) => [entry, ...currentEntries].slice(0, MAX_LOG_ENTRIES));
  }
}
