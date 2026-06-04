import { ReactNativeSSEDevtoolsRegistrationContext } from "@flamefrontend/sse-runtime-react-native";
import { type ReactNode, useCallback, useMemo, useState, useSyncExternalStore } from "react";

import {
  createReactNativeDevtoolsRegistry,
  type ReactNativeDevtoolsSnapshot
} from "../registry/devtools-registry";
import type { ReactNativeDevtoolsClientRecord } from "../registry/types";
import type { DevtoolsTheme } from "../theme/tokens";
import { ReactNativeSSEDevtoolsPanel } from "./sse-devtools-panel";

const EMPTY_SNAPSHOT: ReactNativeDevtoolsSnapshot = new Map();

export type ReactNativeSSEDevtoolsProviderProps = {
  readonly children: ReactNode;
  readonly enabled?: boolean;
  readonly initialOpen?: boolean;
  readonly hideToggleButton?: boolean;
  readonly maxEvents?: number;
  readonly panelHeight?: number;
  readonly theme?: DevtoolsTheme;
  readonly toggleButtonPosition?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  readonly onCopyPayload?: (payload: string) => void | Promise<void>;
  readonly onExportEvents?: (payload: ReactNativeSSEDevtoolsExportPayload) => void | Promise<void>;
};

export type ReactNativeSSEDevtoolsExportPayload = {
  readonly url: string;
  readonly key: string;
  readonly status: ReactNativeDevtoolsClientRecord["status"];
  readonly role: ReactNativeDevtoolsClientRecord["role"];
  readonly totalEvents: number;
  readonly eventsInLog: number;
  readonly truncated: boolean;
  readonly exportedAt: string;
  readonly events: readonly {
    readonly type: string;
    readonly data: unknown;
    readonly timestamp: string;
  }[];
};

export function ReactNativeSSEDevtoolsProvider(
  props: ReactNativeSSEDevtoolsProviderProps
): ReactNode {
  const { children, enabled = true } = props;

  if (!enabled) return children;

  return <ActiveReactNativeSSEDevtoolsProvider {...props} />;
}

type ActiveProps = Omit<ReactNativeSSEDevtoolsProviderProps, "enabled">;

function ActiveReactNativeSSEDevtoolsProvider({
  children,
  initialOpen = false,
  hideToggleButton = false,
  maxEvents,
  onCopyPayload,
  onExportEvents,
  panelHeight = 420,
  theme = "dark",
  toggleButtonPosition = "bottom-right"
}: ActiveProps): ReactNode {
  const registry = useMemo(() => createReactNativeDevtoolsRegistry({ maxEvents }), [maxEvents]);
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [currentTheme, setCurrentTheme] = useState(theme);
  const toggleOpen = useCallback(() => setIsOpen((current) => !current), []);
  const toggleTheme = useCallback(
    () => setCurrentTheme((current) => (current === "dark" ? "light" : "dark")),
    []
  );
  const clients = useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    () => EMPTY_SNAPSHOT
  );

  return (
    <ReactNativeSSEDevtoolsRegistrationContext.Provider value={registry}>
      {children}
      <ReactNativeSSEDevtoolsPanel
        clients={clients}
        clearEvents={registry.clearEvents}
        hideToggleButton={hideToggleButton}
        isOpen={isOpen}
        onCopyPayload={onCopyPayload}
        onExportEvents={onExportEvents}
        panelHeight={panelHeight}
        theme={currentTheme}
        toggleButtonPosition={toggleButtonPosition}
        onToggleTheme={toggleTheme}
        onToggle={toggleOpen}
      />
    </ReactNativeSSEDevtoolsRegistrationContext.Provider>
  );
}
