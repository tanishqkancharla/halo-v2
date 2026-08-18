import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { PluginManifestError } from "../shared/pluginManifest.js";
import { readPluginManifest } from "./readPluginManifest.js";

const pluginTest = test.extend<{ directory: string }>({
  directory: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-plugin-${task.id}-`));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
});

describe("readPluginManifest", () => {
  pluginTest(
    "reads a version 1 plugin and the view.tsx fallback",
    async ({ directory }) => {
      await writePluginFile(
        directory,
        "package.json",
        JSON.stringify({
          name: "halo-plugin-calendar",
          halo: { version: 1, name: "Calendar" },
        }),
      );
      await writePluginFile(
        directory,
        "view.tsx",
        "export const Sidebar = () => null\n",
      );

      const manifest = await readPluginManifest({
        id: "calendar",
        directory,
      });
      if (manifest instanceof Error) throw manifest;

      expect(manifest.id).toBe("calendar");
      expect(manifest.packageName).toBe("halo-plugin-calendar");
      expect(manifest.halo).toEqual({ version: 1, name: "Calendar" });
      expect(manifest.viewPath).toBe(join(directory, "view.tsx"));
      expect(manifest.serverPath).toBeUndefined();
    },
  );

  pluginTest("rejects a missing package.json", async ({ directory }) => {
    const manifest = await readPluginManifest({
      id: "calendar",
      directory,
    });
    expect(manifest).toBeInstanceOf(PluginManifestError);
  });

  pluginTest("rejects a missing halo version", async ({ directory }) => {
    await writePluginFile(
      directory,
      "package.json",
      JSON.stringify({
        name: "halo-plugin-calendar",
        halo: { name: "Calendar" },
      }),
    );

    const manifest = await readPluginManifest({
      id: "calendar",
      directory,
    });
    expect(manifest).toBeInstanceOf(PluginManifestError);
  });

  pluginTest("rejects a missing halo.name", async ({ directory }) => {
    await writePluginFile(
      directory,
      "package.json",
      JSON.stringify({
        name: "halo-plugin-calendar",
        halo: { version: 1 },
      }),
    );

    const manifest = await readPluginManifest({
      id: "calendar",
      directory,
    });
    expect(manifest).toBeInstanceOf(PluginManifestError);
  });

  pluginTest(
    "resolves explicit view and server paths",
    async ({ directory }) => {
      await writePluginFile(
        directory,
        "package.json",
        JSON.stringify({
          name: "halo-plugin-notes",
          halo: {
            version: 1,
            name: "Notes",
            view: "./src/ui.tsx",
            server: "./src/rpc.ts",
          },
        }),
      );
      await writePluginFile(
        directory,
        "src/ui.tsx",
        "export const Routes = () => null\n",
      );
      await writePluginFile(
        directory,
        "src/rpc.ts",
        "export const router = {}\n",
      );

      const manifest = await readPluginManifest({ id: "notes", directory });
      if (manifest instanceof Error) throw manifest;

      expect(manifest.viewPath).toBe(join(directory, "src/ui.tsx"));
      expect(manifest.serverPath).toBe(join(directory, "src/rpc.ts"));
    },
  );

  pluginTest(
    "resolves view/index and server/index fallbacks",
    async ({ directory }) => {
      await writePluginFile(
        directory,
        "package.json",
        JSON.stringify({
          name: "halo-plugin-files",
          halo: { version: 1, name: "Files" },
        }),
      );
      await writePluginFile(
        directory,
        "view/index.tsx",
        "export const Sidebar = () => null\n",
      );
      await writePluginFile(
        directory,
        "server/index.ts",
        "export const router = {}\n",
      );

      const manifest = await readPluginManifest({ id: "files", directory });
      if (manifest instanceof Error) throw manifest;

      expect(manifest.viewPath).toBe(join(directory, "view/index.tsx"));
      expect(manifest.serverPath).toBe(join(directory, "server/index.ts"));
    },
  );
});

async function writePluginFile(
  directory: string,
  relativePath: string,
  contents: string,
) {
  const path = join(directory, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}
