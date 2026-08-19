import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,
  },
  resolve: {
    dedupe: ["react", "react-dom", "purse-styles", "wouter"],
    preserveSymlinks: false,
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
