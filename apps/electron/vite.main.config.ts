import { builtinModules, createRequire } from "node:module";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const packageJson = require("./package.json") as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const dependencyNames = [
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
];

const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
];

export default defineConfig({
  build: {
    lib: {
      entry: "src/main/main.ts",
      fileName: () => "main.js",
      formats: ["es"],
    },
    rollupOptions: {
      // Rolldown's watch binding rejects function externals. Leave packages and
      // Node builtins external so CJS deps are not rewritten to `__require`.
      external: [
        "electron",
        ...nodeBuiltins,
        ...dependencyNames,
        ...dependencyNames.map((name) => new RegExp(`^${escapeRegExp(name)}/`)),
      ],
    },
  },
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
