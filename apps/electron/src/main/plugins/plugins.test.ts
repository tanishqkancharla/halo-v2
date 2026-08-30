import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHaloRpcClient } from "@halo/cli";
import type { PluginToolResult } from "@halo/plugin-sdk/server";
import { Logger } from "@repo/logger";
import { expect, test } from "vitest";
import type { HaloClient } from "../../shared/contract.js";
import { StaticAgentAuthority } from "../agent/runtime/AgentAuthority.js";
import { ToolRuntimeService } from "../agent/runtime/ToolRuntimeService.js";
import { workspaceFilesPlugin } from "../agent/tools/files/WorkspaceFilesPlugin.js";
import { listenHaloRpcHttp } from "../HaloRpcHttp.js";
import type { HaloContext } from "../router.js";
import { SessionRegistry } from "../sessions/SessionRegistry.js";
import { UserService } from "../UserService.js";
import { WorkspaceService } from "../workspace/WorkspaceService.js";
import { PluginService } from "./PluginService.js";
import { PluginToolGrants } from "./PluginToolGrants.js";

type PluginHandle = {
  id: string;
  invoke: (path: string) => Promise<PluginToolResult>;
  setCapabilities: (capabilities: string[]) => Promise<void>;
};

type PluginDriver = {
  create: (input: {
    id: string;
    capabilities: string[];
    source: string;
  }) => Promise<PluginHandle>;
  types: () => Promise<void>;
  build: () => Promise<void>;
  grant: (pluginId: string) => Promise<void>;
};

const pluginTest = test.extend<{
  workspaceRoot: string;
  workspace: {
    writeFile: (filePath: string, contents: string) => Promise<void>;
  };
  plugins: PluginDriver;
}>({
  workspaceRoot: async ({ task }, use) => {
    const workspaceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), `halo-plugin-e2e-workspace-${task.id}-`),
    );
    await use(workspaceRoot);
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  },
  workspace: async ({ workspaceRoot }, use) => {
    await use({
      writeFile: (filePath, contents) =>
        fs.writeFile(path.join(workspaceRoot, filePath), contents),
    });
  },
  plugins: async ({ task, workspaceRoot }, use) => {
    const userDataDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `halo-plugin-e2e-user-${task.id}-`),
    );
    const workspaceService = new WorkspaceService(userDataDir, {
      appVersion: "1.2.3",
    });
    const selected = await workspaceService.select(workspaceRoot);
    if (selected instanceof Error) throw selected;
    const toolRuntime = new ToolRuntimeService({
      workspace: workspaceService,
      user: new UserService(userDataDir),
      toolPlugins: [workspaceFilesPlugin],
      authority: new StaticAgentAuthority(["workspace.files.read"]),
    });
    const sessions = new SessionRegistry({
      workspace: workspaceService,
      toolRuntime,
    });
    const pluginService = new PluginService(workspaceService);
    const grants = new PluginToolGrants(workspaceService);
    const context: HaloContext = {
      workspace: workspaceService,
      sessions,
      toolRuntime,
      pluginToolGrants: grants,
      plugins: pluginService,
      getWindow: () => {
        throw new Error("Halo main window is not open.");
      },
      logger: new Logger(),
    };
    const rpc = await listenHaloRpcHttp({ context, userDataDir });
    if (rpc instanceof Error) throw rpc;
    const client = createHaloRpcClient<HaloClient>({
      version: 1,
      host: rpc.host,
      port: rpc.port,
      token: rpc.token,
    });

    const driver: PluginDriver = {
      create: async (input) => {
        const created = await client.plugins.create({ id: input.id });
        const packagePath = path.join(created.directory, "package.json");
        const setCapabilities = async (capabilities: string[]) => {
          // SAFETY: PluginService.create wrote a package object with a Halo manifest.
          const packageJson = JSON.parse(
            await fs.readFile(packagePath, "utf8"),
          ) as { halo: { capabilities?: string[] } };
          packageJson.halo.capabilities = capabilities;
          await fs.writeFile(
            packagePath,
            `${JSON.stringify(packageJson, undefined, 2)}\n`,
          );
        };
        await setCapabilities(input.capabilities);
        await fs.writeFile(
          path.join(created.directory, "server.ts"),
          input.source,
        );
        return {
          id: created.id,
          invoke: async (procedurePath) => {
            const result = await client.plugins.invoke({
              pluginId: created.id,
              path: procedurePath.split("."),
              input: undefined,
            });
            // SAFETY: this fixture creates procedures returning PluginToolResult.
            return result as PluginToolResult;
          },
          setCapabilities,
        };
      },
      types: async () => {
        const result = await client.plugins.types();
        if (result.diagnostics.length > 0) {
          throw new Error(result.diagnostics[0]?.message);
        }
      },
      build: async () => {
        const result = await client.plugins.build();
        if (result.errors.length > 0) {
          throw new Error(result.errors[0]?.message);
        }
      },
      grant: async (pluginId) => {
        const manifest = await pluginService.getManifest(pluginId);
        if (manifest instanceof Error) throw manifest;
        const declaredPaths =
          manifest.halo.capabilities === undefined
            ? []
            : manifest.halo.capabilities;
        const granted = await grants.grant({ pluginId, declaredPaths });
        if (granted instanceof Error) throw granted;
      },
    };

    await use(driver);
    await rpc.close();
    const sessionsClosed = await sessions.shutdown();
    if (sessionsClosed instanceof Error) throw sessionsClosed;
    const runtimeClosed = await toolRuntime.close();
    if (runtimeClosed instanceof Error) throw runtimeClosed;
    await fs.rm(userDataDir, { recursive: true, force: true });
  },
});

pluginTest(
  "enforces tool grants throughout a plugin invocation",
  async ({ plugins, workspace }) => {
    await workspace.writeFile("message.txt", "hello");
    const reader = await plugins.create({
      id: "reader",
      capabilities: ["files.read"],
      source: `import { pluginOs } from "@get-halo/plugin-sdk/server";

export default {
  read: pluginOs.handler(({ context }) =>
    context.tools.files.read({ path: "message.txt" }),
  ),
};
`,
    });
    await plugins.types();
    await plugins.build();

    expect(await reader.invoke("read")).toMatchObject({
      ok: false,
      error: { code: "tool_not_granted" },
    });

    await plugins.grant(reader.id);
    expect(await reader.invoke("read")).toEqual({
      ok: true,
      data: { path: "message.txt", text: "hello" },
    });

    await reader.setCapabilities([]);
    expect(await reader.invoke("read")).toMatchObject({
      ok: false,
      error: { code: "tool_not_granted" },
    });

    await reader.setCapabilities(["files.read"]);
    expect(await reader.invoke("read")).toMatchObject({
      ok: false,
      error: { code: "tool_not_granted" },
    });

    await plugins.grant(reader.id);
    expect(await reader.invoke("read")).toEqual({
      ok: true,
      data: { path: "message.txt", text: "hello" },
    });
  },
);
