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
import { isEditableTarget, matchesShortcut, parseShortcut } from "../lib/shortcut";
import { loadSettings, patchSettings } from "../lib/persistence";
import { SSEDevtoolsPanel } from "./sse-devtools-panel";

const EMPTY_SNAPSHOT: RegistrySnapshot = new Map();
const DEFAULT_Z_INDEX = 99999;
const DEFAULT_SILENT_TIMEOUT_MS = 60_000;

export type SSEDevtoolsProviderProps = {
  readonly children: ReactNode;
  readonly enabled?: boolean;
  readonly initialOpen?: boolean;
  readonly buttonPosition?: "bottom-left" | "bottom-right";
  readonly panelHeight?: number;
  readonly hideToggleButton?: boolean;
  readonly toggleShortcut?: string;
  readonly maxEvents?: number;
  readonly silentTimeoutMs?: number;
  readonly zIndex?: number;
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
  maxEvents,
  silentTimeoutMs = DEFAULT_SILENT_TIMEOUT_MS,
  zIndex = DEFAULT_Z_INDEX
}: ActiveSSEDevtoolsProviderProps): ReactNode {
  const registry = useMemo(() => createDevtoolsRegistry({ maxEvents }), [maxEvents]);
  const [isOpen, setIsOpen] = useState(() => loadSettings().open ?? initialOpen);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      patchSettings({ open: next });
      return next;
    });
  }, []);

  const clients = useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    () => EMPTY_SNAPSHOT
  );

  useEffect(() => {
    const parsed = parseShortcut(toggleShortcut);
    if (!parsed) return;

    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (matchesShortcut(parsed, e)) {
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
        silentTimeoutMs={silentTimeoutMs}
        zIndex={zIndex}
      />
    </SSEDevtoolsRegistrationContext.Provider>
  );
}
