import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Logger } from "@repo/logger";
import { newMessagePortRpcSession } from "capnweb";
import { describe, expect, test } from "vitest";
import { src } from "../test/fixtures.js";
import {
  WorkspaceNotReadyError,
  WorkspaceService,
} from "../workspace-service.js";
import { loadPluginViews } from "../../renderer/evaluatePluginView.js";
import { HaloRpc } from "../rpc.js";
import { PiService } from "../pi-service.js";
import { UserService } from "../UserService.js";
import type { HaloApi } from "../../shared/rpc.js";
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
    "seeds calendar and the halo-plugin skill when a workspace is chosen",
    async ({ workspace, workspaceRoot }) => {
      const selected = await workspace.select(workspaceRoot);
      if (selected instanceof Error) throw selected;

      const listed = await new PluginService(workspace).list();
      if (listed instanceof Error) throw listed;
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.plugins[0]?.halo.name).toBe("Calendar");
      expect(listed.errors).toEqual([]);

      const loaded = loadPluginViews(listed);
      expect(loaded.views[0]?.Sidebar).toBeTypeOf("function");
      expect(loaded.views[0]?.Routes).toBeTypeOf("function");
      expect(loaded.errors).toEqual([]);

      const repoSkill = await readFile(
        fileURLToPath(
          new URL(
            "../../../../../.agents/skills/halo-plugin/SKILL.md",
            import.meta.url,
          ),
        ),
        "utf8",
      );
      const bundledSkill = await readFile(
        fileURLToPath(
          new URL("../bundled/haloPluginSkill.md", import.meta.url),
        ),
        "utf8",
      );
      expect(bundledSkill).toBe(repoSkill);

      const seededSkill = await readFile(
        join(
          workspaceRoot,
          ".pi",
          "agent",
          "skills",
          "halo-plugin",
          "SKILL.md",
        ),
        "utf8",
      );
      expect(seededSkill).toBe(repoSkill);
    },
  );

  pluginTest(
    "leaves an existing calendar plugin in place",
    async ({ workspace, workspaceRoot }) => {
      const packagePath = join(
        workspaceRoot,
        ".halo",
        "plugins",
        "calendar",
        "package.json",
      );
      await mkdir(dirname(packagePath), { recursive: true });
      await writeFile(
        packagePath,
        src`
          {
            "name": "halo-plugin-calendar",
            "halo": { "version": 1, "name": "Custom" }
          }
        `,
      );

      const selected = await workspace.select(workspaceRoot);
      if (selected instanceof Error) throw selected;

      const listed = await new PluginService(workspace).list();
      if (listed instanceof Error) throw listed;
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.plugins[0]?.halo.name).toBe("Custom");
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
            import { Route, SidebarItem, SidebarSection } from "@halo/plugin-sdk/view"

            export function Sidebar() {
              return (
                <SidebarSection label="Calendar">
                  <SidebarItem href="/">Month</SidebarItem>
                </SidebarSection>
              )
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
    "lists a view that exports neither Sidebar nor Routes",
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
      expect(loaded.views).toHaveLength(1);
      expect(loaded.views[0]?.Sidebar).toBeUndefined();
      expect(loaded.views[0]?.Routes).toBeUndefined();
      expect(loaded.errors).toEqual([]);
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

  pluginTest(
    "round-trips a plugin ping over Cap'n Web and rejects a missing plugin id",
    async ({ workspace, writePlugin, appDataDir }) => {
      await writePlugin({
        calendar: {
          "package.json": src`
            {
              "name": "halo-plugin-calendar",
              "halo": { "version": 1, "name": "Calendar" }
            }
          `,
          "server.ts": src`
            import { RpcTarget, type PluginServerContext } from "@halo/plugin-sdk/server"

            export default class CalendarServer extends RpcTarget {
              constructor(private readonly ctx: PluginServerContext) {
                super()
              }

              ping() {
                return { pluginId: this.ctx.pluginId }
              }

              fail() {
                return new Error("ping failed")
              }
            }
          `,
        },
      });

      const plugins = new PluginService(workspace);
      const listed = await plugins.list();
      if (listed instanceof Error) throw listed;
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.errors).toEqual([]);

      const rpc = new HaloRpc(
        workspace,
        new PiService(workspace, new UserService(appDataDir)),
        plugins,
        () => {
          throw new Error("no window");
        },
        new Logger(),
      );
      const { port1, port2 } = new MessageChannel();
      newMessagePortRpcSession(port1, rpc);
      const api = newMessagePortRpcSession<HaloApi>(port2);
      type CalendarCalls = {
        ping: () => Promise<{ pluginId: string }>;
        fail: () => Promise<void>;
      };
      const calendar = (await api.getPlugin(
        "calendar",
      )) as unknown as CalendarCalls;

      expect(await calendar.ping()).toEqual({ pluginId: "calendar" });
      await expect(calendar.fail()).rejects.toBeInstanceOf(Error);
      await expect(api.getPlugin("missing")).rejects.toBeInstanceOf(Error);

      port1.close();
      port2.close();
    },
  );
});
