import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    server: {
      deps: {
        inline: [
          "maui",
          "@tanishqkancharla/tandem-server",
          "@tanishqkancharla/tandem-core",
        ],
      },
    },
  },
});
