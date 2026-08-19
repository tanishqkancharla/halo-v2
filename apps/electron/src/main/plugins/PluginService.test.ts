import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { src } from "../test/fixtures.js";
import {
  WorkspaceNotReadyError,
  WorkspaceService,
} from "../workspace-service.js";
import { loadPluginViews } from "../../renderer/evaluatePluginView.js";
import { PluginService } from "./PluginService.js";

type PluginFiles = Record<string, string>;
type PluginTree = Record<string, PluginFiles>;

const pluginTest = test.extend<{
  appDataDir: string;
  workspaceRoot: string;
  workspace: WorkspaceService;
  writePlugin: (plugins: PluginTree) => Promise<void>;
}>({
  appDataDir: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-app-${task.id}-`));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
  workspaceRoot: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-ws-${task.id}-`));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
  workspace: async ({ appDataDir }, use) => {
    await use(new WorkspaceService(appDataDir));
  },
  writePlugin: async ({ workspace, workspaceRoot }, use) => {
    const selected = await workspace.select(workspaceRoot);
    if (selected instanceof Error) throw selected;
    const layout = workspace.getLayout();
    if (layout instanceof Error) throw layout;
    await use(async (plugins) => {
      await writePluginFiles(layout.root, plugins);
    });
  },
});

async function writePluginFiles(workspaceRoot: string, plugins: PluginTree) {
  for (const [id, files] of Object.entries(plugins)) {
    for (const [relativePath, contents] of Object.entries(files)) {
      const path = join(workspaceRoot, ".halo", "plugins", id, relativePath);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, contents);
    }
  }
}

describe("PluginService", () => {
  pluginTest(
    "returns WorkspaceNotReadyError before a workspace is chosen",
    async ({ workspace }) => {
      const listed = await new PluginService(workspace).list();
      expect(listed).toBeInstanceOf(WorkspaceNotReadyError);
    },
  );

  pluginTest(
    "lists a valid plugin folder",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        calendar: {
          "package.json": src`
            {
              "name": "halo-plugin-calendar",
              "halo": { "version": 1, "name": "Calendar" }
            }
          `,
          "view.tsx": src`
            export const Sidebar = () => null
          `,
        },
      });

      const listed = await new PluginService(workspace).list();
      if (listed instanceof Error) throw listed;

      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.plugins[0]?.halo.name).toBe("Calendar");
      expect(listed.compiledViews).toHaveLength(1);
      expect(listed.errors).toEqual([]);

      const loaded = loadPluginViews(listed);
      expect(loaded.views).toHaveLength(1);
      expect(loaded.views[0]?.Sidebar).toBeTypeOf("function");
      expect(loaded.views[0]?.Routes).toBeUndefined();
      expect(loaded.errors).toEqual([]);
    },
  );

  pluginTest(
    "loads Sidebar and Routes from an @halo/plugin-sdk/view import",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        calendar: {
          "package.json": src`
            {
              "name": "halo-plugin-calendar",
              "halo": { "version": 1, "name": "Calendar" }
            }
          `,
          "view.tsx": src`
            import { Button, Route } from "@halo/plugin-sdk/view"

            export function Sidebar() {
              return <Button>Calendar</Button>
            }

            export function Routes() {
              return <Route path="/" />
            }
          `,
        },
      });

      const listed = await new PluginService(workspace).list();
      if (listed instanceof Error) throw listed;

      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.compiledViews).toHaveLength(1);
      expect(listed.errors).toEqual([]);

      const loaded = loadPluginViews(listed);
      expect(loaded.views[0]?.Sidebar).toBeTypeOf("function");
      expect(loaded.views[0]?.Routes).toBeTypeOf("function");
      expect(loaded.errors).toEqual([]);
    },
  );

  pluginTest(
    "rejects a view that exports neither Sidebar nor Routes",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        calendar: {
          "package.json": src`
            {
              "name": "halo-plugin-calendar",
              "halo": { "version": 1, "name": "Calendar" }
            }
          `,
          "view.tsx": src`
            export const unused = 1
          `,
        },
      });

      const listed = await new PluginService(workspace).list();
      if (listed instanceof Error) throw listed;

      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.compiledViews).toHaveLength(1);
      expect(listed.errors).toEqual([]);

      const loaded = loadPluginViews(listed);
      expect(loaded.views).toEqual([]);
      expect(loaded.errors.map((error) => error.id)).toEqual(["calendar"]);
    },
  );

  pluginTest(
    "keeps a valid plugin when another package.json is broken",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        calendar: {
          "package.json": src`
            {
              "name": "halo-plugin-calendar",
              "halo": { "version": 1, "name": "Calendar" }
            }
          `,
        },
        broken: {
          "package.json": src`
            { not json
          `,
        },
        ".hidden": {
          "package.json": src`
            {
              "name": "halo-plugin-hidden",
              "halo": { "version": 1, "name": "Hidden" }
            }
          `,
        },
      });

      const listed = await new PluginService(workspace).list();
      if (listed instanceof Error) throw listed;

      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.errors.map((error) => error.id)).toEqual(["broken"]);
    },
  );
});
