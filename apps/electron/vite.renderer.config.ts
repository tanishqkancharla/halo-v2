import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,
  },
  optimizeDeps: {
    include: ["@tandem/core", "@tandem/types", "@halo/plugin-sdk/storage"],
  },
  resolve: {
    alias: {
      // Tandem Logger.ts imports node:fs at module load.
      "node:fs": fileURLToPath(
        new URL("./src/renderer/emptyNodeFs.ts", import.meta.url),
      ),
    },
    dedupe: ["react", "react-dom", "purse-styles", "wouter"],
    preserveSymlinks: false,
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
