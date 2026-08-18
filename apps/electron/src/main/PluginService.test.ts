import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { PluginService } from "./PluginService.js";
import {
  WorkspaceNotReadyError,
  WorkspaceService,
} from "./workspace-service.js";

const pluginServiceTest = test.extend<{
  appDataDir: string;
  workspaceRoot: string;
  workspace: WorkspaceService;
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
});

describe("PluginService", () => {
  pluginServiceTest(
    "returns WorkspaceNotReadyError before a workspace is chosen",
    async ({ workspace }) => {
      const listed = await new PluginService(workspace).list();
      expect(listed).toBeInstanceOf(WorkspaceNotReadyError);
    },
  );

  pluginServiceTest(
    "lists a valid plugin folder",
    async ({ workspace, workspaceRoot }) => {
      const selected = await workspace.select(workspaceRoot);
      if (selected instanceof Error) throw selected;
      const layout = workspace.getLayout();
      if (layout instanceof Error) throw layout;

      await writePluginFile(
        layout.root,
        ".halo/plugins/calendar/package.json",
        JSON.stringify({
          name: "halo-plugin-calendar",
          halo: { version: 1, name: "Calendar" },
        }),
      );
      await writePluginFile(
        layout.root,
        ".halo/plugins/calendar/view.tsx",
        "export const Sidebar = () => null\n",
      );

      const listed = await new PluginService(workspace).list();
      if (listed instanceof Error) throw listed;

      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.plugins[0]?.halo.name).toBe("Calendar");
      expect(listed.errors).toEqual([]);
    },
  );

  pluginServiceTest(
    "keeps a valid plugin when another package.json is broken",
    async ({ workspace, workspaceRoot }) => {
      const selected = await workspace.select(workspaceRoot);
      if (selected instanceof Error) throw selected;
      const layout = workspace.getLayout();
      if (layout instanceof Error) throw layout;

      await writePluginFile(
        layout.root,
        ".halo/plugins/calendar/package.json",
        JSON.stringify({
          name: "halo-plugin-calendar",
          halo: { version: 1, name: "Calendar" },
        }),
      );
      await writePluginFile(
        layout.root,
        ".halo/plugins/broken/package.json",
        "{ not json",
      );
      await writePluginFile(
        layout.root,
        ".halo/plugins/.hidden/package.json",
        JSON.stringify({
          name: "halo-plugin-hidden",
          halo: { version: 1, name: "Hidden" },
        }),
      );

      const listed = await new PluginService(workspace).list();
      if (listed instanceof Error) throw listed;

      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.errors.map((error) => error.id)).toEqual(["broken"]);
    },
  );
});

async function writePluginFile(
  root: string,
  relativePath: string,
  contents: string,
) {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}
