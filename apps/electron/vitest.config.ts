import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    server: {
      deps: {
        // Maui dist uses extensionless imports. Vite must inline it.
        inline: ["maui"],
      },
    },
  },
});
