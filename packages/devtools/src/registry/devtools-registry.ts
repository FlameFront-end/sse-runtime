import type {
  SSEDevtoolsClientInfo,
  SSEDevtoolsRegistration
} from "@flamefrontend/sse-runtime-react";
import type { SSEError } from "@flamefrontend/sse-runtime-core";
import { MAX_EVENTS } from "../constants";
import type { DevtoolsClientRecord, DevtoolsEventEntry, RegistrySnapshot } from "./types";

export type { DevtoolsClientRecord, DevtoolsEventEntry, RegistrySnapshot } from "./types";

export type DevtoolsRegistry = SSEDevtoolsRegistration & {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => RegistrySnapshot;
  readonly clearEvents: (id: string) => void;
};

const scheduleFrame: (callback: () => void) => void =
  typeof requestAnimationFrame === "function"
    ? (callback) => void requestAnimationFrame(() => callback())
    : (callback) => void setTimeout(callback, 16);

function sameError(a: SSEError | null, b: SSEError | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && a.message === b.message && a.status === b.status;
}

export function createDevtoolsRegistry(options: { maxEvents?: number } = {}): DevtoolsRegistry {
  const maxEvents = options.maxEvents ?? MAX_EVENTS;
  const clients = new Map<string, DevtoolsClientRecord>();
  const listeners = new Set<() => void>();
  let snapshot: RegistrySnapshot = new Map();
  let snapshotDirty = false;
  let notifyScheduled = false;
  let clientCounter = 0;
  let eventCounter = 0;

  function invalidate(): void {
    snapshotDirty = true;
    if (notifyScheduled) return;
    notifyScheduled = true;
    scheduleFrame(() => {
      notifyScheduled = false;
      for (const listener of listeners) listener();
    });
  }

  function patch(id: string, update: Partial<Omit<DevtoolsClientRecord, "id" | "client">>): void {
    const record = clients.get(id);
    if (!record) return;
    const hasChanges = Object.entries(update).some(([key, value]) => {
      if (key === "error") {
        return !sameError(record.error, value as SSEError | null);
      }
      return record[key as keyof DevtoolsClientRecord] !== value;
    });
    if (!hasChanges) return;

    clients.set(id, { ...record, ...update });
    invalidate();
  }

  return {
    register(info: SSEDevtoolsClientInfo): () => void {
      const { id: key, url, client } = info;
      const id = `${key}#${(clientCounter += 1)}`;

      const initialStatus = client.getStatus();
      const alreadyOpen = initialStatus === "open";
      const now = Date.now();

      clients.set(id, {
        id,
        key,
        url,
        status: initialStatus,
        error: client.getError(),
        events: [],
        totalEvents: 0,
        connectedAt: alreadyOpen ? now : null,
        firstConnectedAt: alreadyOpen ? now : null,
        reconnectCount: 0,
        lastEventAt: null,
        client
      });
      invalidate();

      const unsubStatus = client.subscribeStatus((status) => {
        const current = clients.get(id);
        if (!current) return;
        if (status === "open") {
          const wasOpen = current.status === "open";
          const isReconnect = !wasOpen && current.firstConnectedAt !== null;
          patch(id, {
            status,
            connectedAt: wasOpen ? current.connectedAt : Date.now(),
            firstConnectedAt: current.firstConnectedAt ?? Date.now(),
            reconnectCount: isReconnect ? current.reconnectCount + 1 : current.reconnectCount
          });
        } else {
          patch(id, { status, connectedAt: null });
        }
      });

      const unsubError = client.subscribeError((error) => {
        patch(id, { error });
      });

      const unsubEvents = client.subscribeAnyEvent((event) => {
        const current = clients.get(id);
        if (!current) return;
        const entry: DevtoolsEventEntry = {
          id: `evt-${(eventCounter += 1)}`,
          type: event.type,
          data: event.data,
          timestamp: Date.now()
        };
        const events =
          current.events.length >= maxEvents
            ? [...current.events.slice(current.events.length - maxEvents + 1), entry]
            : [...current.events, entry];
        patch(id, {
          events,
          totalEvents: current.totalEvents + 1,
          lastEventAt: entry.timestamp
        });
      });

      return () => {
        unsubStatus();
        unsubError();
        unsubEvents();
        clients.delete(id);
        invalidate();
      };
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot(): RegistrySnapshot {
      if (snapshotDirty) {
        snapshot = new Map(clients);
        snapshotDirty = false;
      }
      return snapshot;
    },

    clearEvents(id: string): void {
      patch(id, { events: [], totalEvents: 0, lastEventAt: null });
    }
  };
}
