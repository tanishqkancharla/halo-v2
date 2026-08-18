import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "purse-styles", "wouter"],
  },
  test: {
    server: {
      deps: {
        inline: ["maui"],
      },
    },
  },
});
