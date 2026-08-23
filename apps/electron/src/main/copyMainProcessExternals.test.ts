import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";
import { describe, expect, test } from "vitest";
import { copyMainProcessExternals } from "../../copyMainProcessExternals.js";
import { isCallable } from "../shared/isCallable.js";

const copyTest = test.extend<{ buildPath: string }>({
  buildPath: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-pack-${task.id}-`));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
});

describe("copyMainProcessExternals", () => {
  copyTest(
    "lets packaged main resolve and jiti-load @halo/plugin-sdk",
    async ({ buildPath }) => {
      await copyMainProcessExternals(buildPath);
      const mainPath = join(buildPath, ".vite", "build", "main.cjs");
      await mkdir(join(buildPath, ".vite", "build"), { recursive: true });
      await writeFile(mainPath, "");
      const requireFromMain = createRequire(mainPath);
      const schema = requireFromMain.resolve("@halo/plugin-sdk/schema");
      const server = requireFromMain.resolve("@halo/plugin-sdk/server");
      const storage = requireFromMain.resolve("@halo/plugin-sdk/storage");
      const view = requireFromMain.resolve("@halo/plugin-sdk/view");

      const jiti = createJiti(mainPath, {
        alias: {
          "@halo/plugin-sdk/schema": schema,
          "@halo/plugin-sdk/server": server,
          "@halo/plugin-sdk/storage": storage,
          "@halo/plugin-sdk/view": view,
        },
      });
      // SAFETY: jiti loads this alias from disk; the SDK module exports os and pluginOs.
      const loaded = (await jiti.import("@halo/plugin-sdk/server")) as {
        os: unknown;
        pluginOs: { handler: unknown };
      };
      expect(loaded.os).toBeDefined();
      expect(isCallable({ value: loaded.pluginOs.handler })).toBe(true);
    },
  );
});
