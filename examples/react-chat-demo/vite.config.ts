import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { createMockSSEServer } from "./server/mock-sse-server";

export default defineConfig({
  plugins: [react(), createMockSSEServer()],
  server: {
    host: "0.0.0.0"
  }
});
