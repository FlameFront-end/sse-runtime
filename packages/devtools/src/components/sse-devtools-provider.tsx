import { SSEDevtoolsRegistrationContext } from "@flamefrontend/sse-runtime-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore
} from "react";

import { createDevtoolsRegistry, type RegistrySnapshot } from "../registry/devtools-registry";
import { SSEDevtoolsPanel } from "./sse-devtools-panel";

const EMPTY_SNAPSHOT: RegistrySnapshot = new Map();

export type SSEDevtoolsProviderProps = {
  readonly children: ReactNode;
  readonly enabled?: boolean;
  readonly initialOpen?: boolean;
  readonly buttonPosition?: "bottom-left" | "bottom-right";
  readonly panelHeight?: number;
  readonly hideToggleButton?: boolean;
  readonly toggleShortcut?: string;
  readonly maxEvents?: number;
};

type ActiveSSEDevtoolsProviderProps = Omit<SSEDevtoolsProviderProps, "enabled">;

export function SSEDevtoolsProvider(props: SSEDevtoolsProviderProps): ReactNode {
  const { children, enabled = true } = props;

  if (!enabled) return children;

  return <ActiveSSEDevtoolsProvider {...props} />;
}

function ActiveSSEDevtoolsProvider({
  children,
  initialOpen = false,
  buttonPosition = "bottom-right",
  panelHeight = 320,
  hideToggleButton = false,
  toggleShortcut = "alt+d",
  maxEvents
}: ActiveSSEDevtoolsProviderProps): ReactNode {
  const registry = useMemo(() => createDevtoolsRegistry({ maxEvents }), [maxEvents]);
  const [isOpen, setIsOpen] = useState(initialOpen);
  const toggleOpen = useCallback(() => setIsOpen((o) => !o), []);

  const clients = useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    () => EMPTY_SNAPSHOT
  );

  useEffect(() => {
    if (!toggleShortcut) return;
    const parts = toggleShortcut.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    const needAlt = parts.includes("alt");
    const needCtrl = parts.includes("ctrl");
    const needShift = parts.includes("shift");
    const needMeta = parts.includes("meta");

    const handler = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === key &&
        e.altKey === needAlt &&
        e.ctrlKey === needCtrl &&
        e.shiftKey === needShift &&
        e.metaKey === needMeta
      ) {
        e.preventDefault();
        toggleOpen();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleShortcut, toggleOpen]);

  return (
    <SSEDevtoolsRegistrationContext.Provider value={registry}>
      {children}
      <SSEDevtoolsPanel
        clients={clients}
        clearEvents={registry.clearEvents}
        isOpen={isOpen}
        onToggle={toggleOpen}
        buttonPosition={buttonPosition}
        panelHeight={panelHeight}
        hideToggleButton={hideToggleButton}
      />
    </SSEDevtoolsRegistrationContext.Provider>
  );
}
