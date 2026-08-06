import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "purse-styles"],
    preserveSymlinks: false,
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
