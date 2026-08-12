import { builtinModules } from "node:module";
import { defineConfig } from "vite";

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
    rollupOptions: {
      // Native modules cannot be bundled into main.cjs.
      external: [
        "electron",
        "electron/main",
        "@parcel/watcher",
        /^@parcel\/watcher-/,
        ...nodeBuiltins,
      ],
    },
  },
});
