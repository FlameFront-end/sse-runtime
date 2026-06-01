export type ChatEvents = {
  readonly message: {
    readonly id: string;
    readonly author: string;
    readonly text: string;
    readonly timestamp: string;
  };
  readonly progress: {
    readonly value: number;
    readonly label: string;
  };
  readonly done: {
    readonly chatId: string;
    readonly summary: string;
  };
};

export type ConnectionStatus = "idle" | "connecting" | "open" | "reconnecting" | "error" | "closed";

export type RuntimeError = {
  readonly kind: "auth" | "handler" | "transport";
  readonly message: string;
  readonly status?: number;
};

export type ChatMessage = ChatEvents["message"];

export type StreamLogEntry = {
  readonly id: string;
  readonly kind: keyof ChatEvents;
  readonly title: string;
  readonly detail: string;
  readonly timestamp: string;
};

export type FailureMode = "none" | "close-after-3" | "401-once" | "slow-start" | "bad-json";

export type CoordinationRole = "leader" | "follower" | null;

export type ChatStreamState = {
  readonly status: ConnectionStatus;
  readonly error: RuntimeError | null;
  readonly messages: readonly ChatMessage[];
  readonly progress: number;
  readonly summary: string;
  readonly logEntries: readonly StreamLogEntry[];
  readonly isConnected: boolean;
  readonly coordinationRole: CoordinationRole;
  readonly failureMode: FailureMode;
  readonly setFailureMode: (mode: FailureMode) => void;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => void;
};
