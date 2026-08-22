import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Browser ESM cannot load CJS packages such as Pierre. Vite writes one
  // prebundle and reuses it until dependencies change. Use tmpdir because
  // pnpm's content-addressable store is read-only when this package is
  // installed from npm.
  cacheDir: path.join(os.tmpdir(), "tkstack-vite"),
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-dev-runtime",
      "maui",
      "purse-styles",
      "@pierre/diffs/react",
      "beautiful-mermaid",
      "errore",
    ],
  },
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "purse-styles"],
  },
  clearScreen: false,
  server: {
    port: 4177,
    strictPort: false,
  },
});
