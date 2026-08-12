import { builtinModules } from "node:module";
import { defineConfig } from "vite";
import { viteMainExternals } from "./mainExternals.js";

const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
];

export default defineConfig({
  build: {
    // Forge Vite only packs `/.vite`. Bundle npm packages into main.
    minify: false,
    // Without platform:node, Rolldown replaces import.meta with {} for CJS
    // (EMPTY_IMPORT_META) and Pi/Halo crash on fileURLToPath({}.url).
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
      entry: "src/main/main.ts",
      // .cjs required: package.json has "type":"module", so .js is treated as ESM.
      fileName: () => "main.cjs",
      formats: ["cjs"],
    },
  },
});
