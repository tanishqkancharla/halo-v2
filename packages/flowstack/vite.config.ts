import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Browser ESM cannot load CJS packages such as Pierre. Vite writes one
  // prebundle into this directory and reuses it until dependencies change.
  cacheDir: path.join(packageRoot, "node_modules/.vite"),
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-dev-runtime",
      "maui",
      "purse-styles",
      "@pierre/diffs/react",
      "@dagrejs/dagre",
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
    port: 4188,
    strictPort: false,
  },
});
