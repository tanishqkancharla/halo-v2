import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rendererPort = process.env.HALO_RENDERER_PORT;

export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,
  },
  optimizeDeps: {
    include: [
      "@tandem/core",
      "@tandem/react",
      "@tandem/types",
      "@halo/plugin-sdk/storage",
    ],
  },
  resolve: {
    dedupe: ["react", "react-dom", "purse-styles", "wouter"],
    preserveSymlinks: false,
  },
  clearScreen: false,
  server: {
    port: rendererPort === undefined ? 1420 : Number(rendererPort),
    strictPort: true,
  },
});
