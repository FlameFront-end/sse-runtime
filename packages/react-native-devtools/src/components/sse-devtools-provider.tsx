import { ReactNativeSSEDevtoolsRegistrationContext } from "@flamefrontend/sse-runtime-react-native";
import { type ReactNode, useCallback, useMemo, useState, useSyncExternalStore } from "react";

import {
  createReactNativeDevtoolsRegistry,
  type ReactNativeDevtoolsSnapshot
} from "../registry/devtools-registry";
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
  panelHeight = 420,
  theme = "dark",
  toggleButtonPosition = "bottom-right"
}: ActiveProps): ReactNode {
  const registry = useMemo(() => createReactNativeDevtoolsRegistry({ maxEvents }), [maxEvents]);
  const [isOpen, setIsOpen] = useState(initialOpen);
  const toggleOpen = useCallback(() => setIsOpen((current) => !current), []);
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
        panelHeight={panelHeight}
        theme={theme}
        toggleButtonPosition={toggleButtonPosition}
        onToggle={toggleOpen}
      />
    </ReactNativeSSEDevtoolsRegistrationContext.Provider>
  );
}
