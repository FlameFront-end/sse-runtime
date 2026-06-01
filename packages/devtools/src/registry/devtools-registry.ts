import type {
  SSEDevtoolsClientInfo,
  SSEDevtoolsRegistration
} from "@flamefrontend/sse-runtime-react";
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

export function createDevtoolsRegistry(options: { maxEvents?: number } = {}): DevtoolsRegistry {
  const maxEvents = options.maxEvents ?? MAX_EVENTS;
  const clients = new Map<string, DevtoolsClientRecord>();
  const listeners = new Set<() => void>();
  let snapshot: RegistrySnapshot = new Map();
  let notifyScheduled = false;
  let instanceCounter = 0;

  function commit(): void {
    snapshot = new Map(clients);
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
    const hasChanges = Object.entries(update).some(
      ([key, value]) => record[key as keyof DevtoolsClientRecord] !== value
    );
    if (!hasChanges) return;

    clients.set(id, { ...record, ...update });
    commit();
  }

  return {
    register(info: SSEDevtoolsClientInfo): () => void {
      const { id: key, url, client } = info;
      const id = `${key}#${(instanceCounter += 1)}`;

      clients.set(id, {
        id,
        key,
        url,
        status: client.getStatus(),
        error: client.getError(),
        events: [],
        totalEvents: 0,
        connectedAt: null,
        client
      });
      commit();

      const unsubStatus = client.subscribeStatus((status) => {
        const current = clients.get(id);
        if (!current) return;
        const connectedAt = status === "open" ? Date.now() : null;
        patch(id, { status, connectedAt });
      });

      const unsubError = client.subscribeError((error) => {
        patch(id, { error });
      });

      const unsubEvents = client.subscribeAnyEvent((event) => {
        const current = clients.get(id);
        if (!current) return;
        const entry: DevtoolsEventEntry = {
          id: `${Date.now()}-${(instanceCounter += 1)}`,
          type: event.type,
          data: event.data,
          timestamp: Date.now()
        };
        const events = [...current.events, entry].slice(-maxEvents);
        patch(id, { events, totalEvents: current.totalEvents + 1 });
      });

      return () => {
        unsubStatus();
        unsubError();
        unsubEvents();
        clients.delete(id);
        commit();
      };
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot(): RegistrySnapshot {
      return snapshot;
    },

    clearEvents(id: string): void {
      patch(id, { events: [], totalEvents: 0 });
    }
  };
}
