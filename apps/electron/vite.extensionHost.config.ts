import { builtinModules } from "node:module";
import { defineConfig } from "vite";
import { viteMainExternals } from "./mainExternals.js";

const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
];

export default defineConfig({
  build: {
    minify: false,
    rolldownOptions: {
      platform: "node",
      external: [
        "electron",
        "electron/main",
        ...viteMainExternals(),
        ...nodeBuiltins,
      ],
      output: {
        codeSplitting: false,
      },
    },
    lib: {
      entry: "src/main/extensionHostMain.ts",
      fileName: () => "extensionHost.cjs",
      formats: ["cjs"],
    },
  },
});
