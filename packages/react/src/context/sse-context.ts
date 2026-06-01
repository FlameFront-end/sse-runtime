import { createContext } from "react";

// Typed as unknown because React context cannot be generic at definition time.
// Callers narrow the type via useSSEContext<Events>().
export const SSEContext = createContext<unknown>(null);
