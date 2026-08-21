import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
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
