import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import { RPCHandler } from "@orpc/server/message-port";
import { Logger } from "@repo/logger";
import { describe, expect, test } from "vitest";
import type { HaloClient } from "../../shared/contract.js";
import { src } from "../test/fixtures.js";
import {
  WorkspaceNotReadyError,
  WorkspaceService,
} from "../workspace-service.js";
import { loadPluginViews } from "../../renderer/evaluatePluginView.js";
import { AgentSessionRegistry } from "../AgentSessionRegistry.js";
import { PiService } from "../pi-service.js";
import { UserService } from "../UserService.js";
import { bindHaloContext, router, type HaloContext } from "../router.js";
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

async function listPlugins(workspace: WorkspaceService) {
  const listed = await new PluginService(workspace).list();
  if (listed instanceof Error) throw listed;
  return listed;
}

async function withHaloClient(
  workspace: WorkspaceService,
  appDataDir: string,
  run: (client: HaloClient) => Promise<void>,
) {
  const sessions = new AgentSessionRegistry();
  const plugins = new PluginService(workspace);
  const context: HaloContext = {
    workspace,
    pi: new PiService(workspace, new UserService(appDataDir)),
    plugins,
    sessions,
    getWindow: () => {
      throw new Error("no window");
    },
    logger: new Logger(),
  };
  const handler = new RPCHandler(router, {
    routingInterceptors: [bindHaloContext],
  });
  const { port1, port2 } = new MessageChannel();
  handler.upgrade(port1, { context });
  const link = new RPCLink({ port: port2 });
  port1.start();
  port2.start();
  // SAFETY: this MessageChannel talks to the Halo router under test.
  const client = createORPCClient(link) as HaloClient;
  await run(client);
  port1.close();
  port2.close();
}

type PluginTestClient = {
  ping: () => Promise<
    | string
    | {
        pluginId: string;
        workspaceRoot?: string;
      }
  >;
  fail: () => Promise<never>;
};

function pluginClient(client: HaloClient, id: string) {
  const nested = client.plugins[id];
  if (nested === undefined) {
    throw new Error(`plugin client '${id}' is missing`);
  }
  // SAFETY: plugin routers under test expose ping and fail as client methods.
  return nested as PluginTestClient;
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
    "seeds calendar, the halo-plugin skill, and the maui skill when a workspace is chosen",
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

      const skillTemplate = await readFile(
        fileURLToPath(new URL("./haloPluginSkill.md", import.meta.url)),
        "utf8",
      );
      expect(skillTemplate).toContain("{{HALO_COMPILE_PLUGIN_VIEW}}");

      const compilePluginViewPath = fileURLToPath(
        new URL("./compilePluginView.ts", import.meta.url),
      );
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
      expect(seededSkill).toBe(
        skillTemplate.replaceAll(
          "{{HALO_COMPILE_PLUGIN_VIEW}}",
          compilePluginViewPath,
        ),
      );
      expect(seededSkill).not.toContain("{{HALO_COMPILE_PLUGIN_VIEW}}");

      const repoMauiSkill = await readFile(
        fileURLToPath(
          new URL(
            "../../../../../.agents/skills/maui/SKILL.md",
            import.meta.url,
          ),
        ),
        "utf8",
      );
      const bundledMauiSkill = await readFile(
        fileURLToPath(new URL("../bundled/mauiSkill.md", import.meta.url)),
        "utf8",
      );
      expect(bundledMauiSkill).toBe(repoMauiSkill);
      const seededMauiSkill = await readFile(
        join(workspaceRoot, ".pi", "agent", "skills", "maui", "SKILL.md"),
        "utf8",
      );
      expect(seededMauiSkill).toBe(repoMauiSkill);
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
    "round-trips a plugin ping over oRPC and rejects a missing plugin id",
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
            import { pluginOs } from "@halo/plugin-sdk/server"

            const plugin = pluginOs

            export default {
              ping: plugin.handler(async ({ context }) => ({
                pluginId: context.pluginId,
              })),
              fail: plugin.handler(() => new Error("ping failed")),
            }
          `,
        },
      });

      await withHaloClient(workspace, appDataDir, async (client) => {
        const listed = await client.listPlugins();
        expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
        expect(listed.errors).toEqual([]);

        expect(await pluginClient(client, "calendar").ping()).toEqual({
          pluginId: "calendar",
        });
        await expect(
          pluginClient(client, "calendar").fail(),
        ).rejects.toBeInstanceOf(Error);
        await expect(
          pluginClient(client, "missing").ping(),
        ).rejects.toBeInstanceOf(Error);
      });
    },
  );

  pluginTest(
    "leaves existing halo-plugin and maui skills in place",
    async ({ workspace, workspaceRoot }) => {
      const pluginSkillPath = join(
        workspaceRoot,
        ".pi",
        "agent",
        "skills",
        "halo-plugin",
        "SKILL.md",
      );
      const mauiSkillPath = join(
        workspaceRoot,
        ".pi",
        "agent",
        "skills",
        "maui",
        "SKILL.md",
      );
      await mkdir(dirname(pluginSkillPath), { recursive: true });
      await mkdir(dirname(mauiSkillPath), { recursive: true });
      await writeFile(pluginSkillPath, "keep plugin\n");
      await writeFile(mauiSkillPath, "keep maui\n");

      const selected = await workspace.select(workspaceRoot);
      if (selected instanceof Error) throw selected;

      expect(await readFile(pluginSkillPath, "utf8")).toBe("keep plugin\n");
      expect(await readFile(mauiSkillPath, "utf8")).toBe("keep maui\n");
    },
  );

  pluginTest(
    "returns an empty list when the plugins folder is gone",
    async ({ workspace, workspaceRoot }) => {
      const selected = await workspace.select(workspaceRoot);
      if (selected instanceof Error) throw selected;
      await rm(join(workspaceRoot, ".halo", "plugins"), {
        recursive: true,
        force: true,
      });

      expect(await listPlugins(workspace)).toEqual({
        plugins: [],
        compiledViews: [],
        errors: [],
      });
    },
  );

  pluginTest(
    "lists plugin ids in sorted order",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        zeta: {
          "package.json": src`
            {
              "name": "halo-plugin-zeta",
              "halo": { "version": 1, "name": "Zeta" }
            }
          `,
        },
        alpha: {
          "package.json": src`
            {
              "name": "halo-plugin-alpha",
              "halo": { "version": 1, "name": "Alpha" }
            }
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual([
        "alpha",
        "calendar",
        "zeta",
      ]);
    },
  );

  pluginTest(
    "records a folder with no package.json and keeps other plugins",
    async ({ workspace, workspaceRoot, writePlugin }) => {
      await writePlugin({
        notes: {
          "package.json": src`
            {
              "name": "halo-plugin-notes",
              "halo": { "version": 1, "name": "Notes" }
            }
          `,
        },
      });
      await mkdir(join(workspaceRoot, ".halo", "plugins", "empty"));

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual([
        "calendar",
        "notes",
      ]);
      expect(listed.errors.map((error) => error.id)).toEqual(["empty"]);
      expect(listed.errors[0]?.message).toMatch(/missing package.json/);
    },
  );

  pluginTest(
    "records an empty halo name",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        notes: {
          "package.json": src`
            {
              "name": "halo-plugin-notes",
              "halo": { "version": 1, "name": "" }
            }
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.errors.map((error) => error.id)).toEqual(["notes"]);
    },
  );

  pluginTest(
    "records a missing halo version",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        notes: {
          "package.json": src`
            {
              "name": "halo-plugin-notes",
              "halo": { "name": "Notes" }
            }
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.errors.map((error) => error.id)).toEqual(["notes"]);
    },
  );

  pluginTest(
    "records a missing package.json name",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        notes: {
          "package.json": src`
            {
              "halo": { "version": 1, "name": "Notes" }
            }
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.errors.map((error) => error.id)).toEqual(["notes"]);
      expect(listed.errors[0]?.message).toMatch(/name/);
    },
  );

  pluginTest(
    "lists extra halo keys and an explicit view path",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        notes: {
          "package.json": src`
            {
              "name": "halo-plugin-notes",
              "halo": {
                "version": 1,
                "name": "Notes",
                "view": "./src/page.tsx",
                "extra": "ok"
              }
            }
          `,
          "src/page.tsx": src`
            export const Sidebar = () => undefined
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual([
        "calendar",
        "notes",
      ]);
      expect(listed.plugins[1]?.halo.name).toBe("Notes");
      expect(listed.errors).toEqual([]);

      const loaded = loadPluginViews(listed);
      expect(loaded.views.map((view) => view.id)).toEqual([
        "calendar",
        "notes",
      ]);
      expect(loaded.views[1]?.Sidebar).toBeTypeOf("function");
    },
  );

  pluginTest(
    "records a missing explicit view file",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        notes: {
          "package.json": src`
            {
              "name": "halo-plugin-notes",
              "halo": { "version": 1, "name": "Notes", "view": "./missing.tsx" }
            }
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.errors.map((error) => error.id)).toEqual(["notes"]);
      expect(listed.errors[0]?.message).toMatch(/missing view file/);
    },
  );

  pluginTest(
    "loads view/index.tsx when view.tsx is absent",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        notes: {
          "package.json": src`
            {
              "name": "halo-plugin-notes",
              "halo": { "version": 1, "name": "Notes" }
            }
          `,
          "view/index.tsx": src`
            export const Routes = () => undefined
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual([
        "calendar",
        "notes",
      ]);
      expect(listed.errors).toEqual([]);

      const loaded = loadPluginViews(listed);
      const notes = loaded.views.find((view) => view.id === "notes");
      expect(notes?.Sidebar).toBeUndefined();
      expect(notes?.Routes).toBeTypeOf("function");
    },
  );

  pluginTest(
    "loads a Routes-only view and a server-only plugin",
    async ({ workspace, writePlugin, appDataDir }) => {
      await writePlugin({
        notes: {
          "package.json": src`
            {
              "name": "halo-plugin-notes",
              "halo": { "version": 1, "name": "Notes" }
            }
          `,
          "view.tsx": src`
            export function Routes() {
              return undefined
            }
          `,
        },
        ping: {
          "package.json": src`
            {
              "name": "halo-plugin-ping",
              "halo": { "version": 1, "name": "Ping" }
            }
          `,
          "server.ts": src`
            import { pluginOs } from "@halo/plugin-sdk/server"

            const plugin = pluginOs

            export default {
              ping: plugin.handler(async ({ context }) => ({
                pluginId: context.pluginId,
                workspaceRoot: context.workspaceRoot,
              })),
            }
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual([
        "calendar",
        "notes",
        "ping",
      ]);
      expect(listed.compiledViews.map((view) => view.id)).toEqual([
        "calendar",
        "notes",
      ]);
      expect(listed.errors).toEqual([]);

      const loaded = loadPluginViews(listed);
      expect(
        loaded.views.find((view) => view.id === "notes")?.Sidebar,
      ).toBeUndefined();
      expect(
        loaded.views.find((view) => view.id === "notes")?.Routes,
      ).toBeTypeOf("function");

      const layout = workspace.getLayout();
      if (layout instanceof Error) throw layout;
      await withHaloClient(workspace, appDataDir, async (client) => {
        await client.listPlugins();
        expect(await pluginClient(client, "ping").ping()).toEqual({
          pluginId: "ping",
          workspaceRoot: layout.root,
        });
        await expect(
          pluginClient(client, "calendar").ping(),
        ).rejects.toBeInstanceOf(Error);
        await expect(
          pluginClient(client, "notes").ping(),
        ).rejects.toBeInstanceOf(Error);
      });
    },
  );

  pluginTest(
    "loads a named router export and a named Server object export",
    async ({ workspace, writePlugin, appDataDir }) => {
      await writePlugin({
        named: {
          "package.json": src`
            {
              "name": "halo-plugin-named",
              "halo": { "version": 1, "name": "Named" }
            }
          `,
          "server.ts": src`
            import { pluginOs } from "@halo/plugin-sdk/server"

            export const router = {
              ping: pluginOs.handler(async ({ context }) => context.pluginId),
            }
          `,
        },
        serverExport: {
          "package.json": src`
            {
              "name": "halo-plugin-server-export",
              "halo": { "version": 1, "name": "ServerExport" }
            }
          `,
          "server.ts": src`
            import { pluginOs } from "@halo/plugin-sdk/server"

            export const Server = {
              ping: pluginOs.handler(async ({ context }) => context.pluginId),
            }
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual([
        "calendar",
        "named",
        "serverExport",
      ]);
      expect(listed.errors).toEqual([]);

      await withHaloClient(workspace, appDataDir, async (client) => {
        await client.listPlugins();
        expect(await pluginClient(client, "named").ping()).toBe("named");
        expect(await pluginClient(client, "serverExport").ping()).toBe(
          "serverExport",
        );
      });
    },
  );

  pluginTest(
    "loads server/index.ts as a default oRPC router",
    async ({ workspace, writePlugin, appDataDir }) => {
      await writePlugin({
        ping: {
          "package.json": src`
            {
              "name": "halo-plugin-ping",
              "halo": { "version": 1, "name": "Ping" }
            }
          `,
          "server/index.ts": src`
            import { pluginOs } from "@halo/plugin-sdk/server"

            export default {
              ping: pluginOs.handler(() => "pong"),
            }
          `,
        },
      });

      await withHaloClient(workspace, appDataDir, async (client) => {
        await client.listPlugins();
        expect(await pluginClient(client, "ping").ping()).toBe("pong");
      });
    },
  );

  pluginTest(
    "records a class or function server export",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        boom: {
          "package.json": src`
            {
              "name": "halo-plugin-boom",
              "halo": { "version": 1, "name": "Boom" }
            }
          `,
          "server.ts": src`
            export default class Boom {
              ping() {
                return 1
              }
            }
          `,
        },
        fn: {
          "package.json": src`
            {
              "name": "halo-plugin-fn",
              "halo": { "version": 1, "name": "Fn" }
            }
          `,
          "server.ts": src`
            export default function boom() {
              return 1
            }
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.errors.map((error) => error.id)).toEqual(["boom", "fn"]);
      expect(listed.errors[0]?.message).toMatch(/must export an oRPC router/);
      expect(listed.errors[1]?.message).toMatch(/must export an oRPC router/);
    },
  );

  pluginTest(
    "keeps a valid plugin when another view fails to compile",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        boom: {
          "package.json": src`
            {
              "name": "halo-plugin-boom",
              "halo": { "version": 1, "name": "Boom" }
            }
          `,
          "view.tsx": src`
            export const Sidebar = (
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.errors.map((error) => error.id)).toEqual(["boom"]);
      expect(listed.errors[0]?.message).toMatch(/failed to compile/);

      const loaded = loadPluginViews(listed);
      expect(loaded.views.map((view) => view.id)).toEqual(["calendar"]);
      expect(loaded.views[0]?.Sidebar).toBeTypeOf("function");
    },
  );

  pluginTest(
    "keeps a valid plugin when another view throws while evaluating",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        boom: {
          "package.json": src`
            {
              "name": "halo-plugin-boom",
              "halo": { "version": 1, "name": "Boom" }
            }
          `,
          "view.tsx": src`
            throw new Error("view boom")
            export function Sidebar() {
              return undefined
            }
          `,
        },
      });

      const listed = await listPlugins(workspace);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual([
        "boom",
        "calendar",
      ]);
      expect(listed.errors).toEqual([]);

      const loaded = loadPluginViews(listed);
      expect(loaded.views.map((view) => view.id)).toEqual(["calendar"]);
      expect(loaded.errors.map((error) => error.id)).toEqual(["boom"]);
      expect(loaded.errors[0]?.message).toMatch(/failed to evaluate/);
    },
  );

  pluginTest(
    "reloads compiled views from disk on the next list",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        notes: {
          "package.json": src`
            {
              "name": "halo-plugin-notes",
              "halo": { "version": 1, "name": "Notes" }
            }
          `,
          "view.tsx": src`
            export const Sidebar = () => undefined
          `,
        },
      });

      const first = loadPluginViews(await listPlugins(workspace));
      expect(
        first.views.find((view) => view.id === "notes")?.Routes,
      ).toBeUndefined();

      await writePlugin({
        notes: {
          "view.tsx": src`
            export const Sidebar = () => undefined
            export const Routes = () => undefined
          `,
        },
      });

      const second = loadPluginViews(await listPlugins(workspace));
      expect(
        second.views.find((view) => view.id === "notes")?.Routes,
      ).toBeTypeOf("function");
    },
  );
});
