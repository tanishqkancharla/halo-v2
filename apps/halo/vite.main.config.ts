import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "electron/main.ts",
      fileName: () => "main.js",
      formats: ["es"],
    },
  },
});
