import type {
  SSEConnectionStatus,
  SSEError,
  SSEErrorListener,
  SSEStatusListener
} from "../types/public";

export type SSEClientState = {
  readonly getError: () => SSEError | null;
  readonly getStatus: () => SSEConnectionStatus;
  readonly resetError: () => void;
  readonly setError: (error: SSEError | null) => void;
  readonly setStatus: (status: SSEConnectionStatus) => void;
  readonly subscribeError: (listener: SSEErrorListener) => () => void;
  readonly subscribeStatus: (listener: SSEStatusListener) => () => void;
};

export function createSSEClientState(initialStatus: SSEConnectionStatus): SSEClientState {
  let status = initialStatus;
  let error: SSEError | null = null;
  const errorListeners = new Set<SSEErrorListener>();
  const statusListeners = new Set<SSEStatusListener>();

  return {
    getError(): SSEError | null {
      return error;
    },

    getStatus(): SSEConnectionStatus {
      return status;
    },

    resetError(): void {
      setError(null);
    },

    setError(nextError: SSEError | null): void {
      setError(nextError);
    },

    setStatus(nextStatus: SSEConnectionStatus): void {
      if (status === nextStatus) {
        return;
      }

      status = nextStatus;
      notifyStatusListeners();
    },

    subscribeError(listener: SSEErrorListener): () => void {
      errorListeners.add(listener);
      listener(error);

      return () => {
        errorListeners.delete(listener);
      };
    },

    subscribeStatus(listener: SSEStatusListener): () => void {
      statusListeners.add(listener);
      listener(status);

      return () => {
        statusListeners.delete(listener);
      };
    }
  };

  function notifyStatusListeners(): void {
    statusListeners.forEach((listener) => listener(status));
  }

  function notifyErrorListeners(): void {
    errorListeners.forEach((listener) => listener(error));
  }

  function setError(nextError: SSEError | null): void {
    if (error === nextError) {
      return;
    }

    error = nextError;
    notifyErrorListeners();
  }
}
