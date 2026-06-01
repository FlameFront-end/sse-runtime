import { SSEDevtoolsProvider } from "@flamefrontend/sse-runtime-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/app";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <SSEDevtoolsProvider
      enabled={true}
      maxEvents={1000}
      toggleShortcut="ctrl+shift+d"
      panelHeight={400}
    >
      <App />
    </SSEDevtoolsProvider>
  </StrictMode>
);
