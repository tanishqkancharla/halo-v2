import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHaloRpcClient } from "@halo/cli";
import type { PluginToolResult } from "@halo/plugin-sdk/server";
import { Logger } from "@repo/logger";
import { expect, test } from "vitest";
import {
  haloProtocolVersion,
  type HaloClient,
} from "@get-halo/shared/contract";
import {
  createWorkspaceFilesPlugin,
  type CredentialVault,
  StaticAgentAuthority,
  ToolRuntimeService,
} from "../agent.js";
import { FilesystemService } from "../filesystem.js";
import { closeHaloHttp, listenHaloHttp } from "../http.js";
import {
  copyPluginWorkspacePackages,
  installPluginSdkContract,
  PluginService,
  PluginToolGrants,
} from "../plugins.js";
import type { HaloContext } from "../router.js";
import { SessionRegistry } from "../sessions.js";
import { WorkspaceService } from "../workspace.js";

type PluginHandle = {
  id: string;
  invoke: <Result>(path: string) => Promise<Result>;
  setCapabilities: (capabilities: string[]) => Promise<void>;
  writeServer: (source: string) => Promise<void>;
};

type PluginDriver = {
  client: HaloClient;
  credentials: {
    cli: string;
    renderer: string;
  };
  rendererClient: HaloClient;
  unauthorizedClient: HaloClient;
  create: (input: {
    id: string;
    capabilities: string[];
    source?: string;
    storage?: boolean;
  }) => Promise<PluginHandle>;
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
    const filesystemService = new FilesystemService();
    const workspaceService = new WorkspaceService({
      appDataDir: userDataDir,
      filesystem: filesystemService,
      appVersion: "1.2.3",
    });
    const selected = await workspaceService.select(workspaceRoot);
    if (selected instanceof Error) throw selected;
    const pluginService = new PluginService({
      filesystem: filesystemService,
      workspace: workspaceService,
      dependencyInstaller: async (directory) => {
        const contract = await installPluginSdkContract({
          directory,
          appVersion: workspaceService.appVersion,
        });
        if (contract instanceof Error) return contract;
        return copyPluginWorkspacePackages(directory);
      },
    });
    const grants = new PluginToolGrants({
      filesystem: filesystemService,
      workspace: workspaceService,
    });
    const toolRuntime = new ToolRuntimeService({
      filesystem: filesystemService,
      workspace: workspaceService,
      ownerUserId: Promise.resolve("plugin-test-user"),
      createCredentialVault: () => new TestCredentialVault(),
      toolPlugins: [createWorkspaceFilesPlugin(filesystemService)],
      authority: new StaticAgentAuthority(["workspace.files.read"]),
    });
    const sessions = new SessionRegistry({
      filesystem: filesystemService,
      workspace: workspaceService,
      toolRuntime,
    });
    const context: HaloContext = {
      workspace: workspaceService,
      sessions,
      toolRuntime,
      pluginToolGrants: grants,
      plugins: pluginService,
      logger: new Logger(),
    };
    const rpc = await listenHaloHttp({
      context,
      host: "127.0.0.1",
      port: 0,
      corsOrigins: [],
    });
    if (rpc instanceof Error) throw rpc;
    const client = createHaloRpcClient<HaloClient>({
      version: 1,
      host: "127.0.0.1",
      port: rpc.connections.cli.port,
      token: rpc.connections.cli.token,
    });
    const rendererClient = createHaloRpcClient<HaloClient>({
      version: 1,
      host: "127.0.0.1",
      port: rpc.connections.renderer.port,
      token: rpc.connections.renderer.token,
    });
    const unauthorizedClient = createHaloRpcClient<HaloClient>({
      version: 1,
      host: "127.0.0.1",
      port: rpc.connections.cli.port,
      token: "unknown-token",
    });

    const driver: PluginDriver = {
      client,
      credentials: {
        cli: rpc.connections.cli.token,
        renderer: rpc.connections.renderer.token,
      },
      rendererClient,
      unauthorizedClient,
      create: async (input) => {
        const created = await client.plugins.create({
          id: input.id,
          storage: input.storage,
        });
        const packagePath = path.join(created.directory, "package.json");
        const serverPath = path.join(created.directory, "server.ts");
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
        const writeServer = (source: string) =>
          fs.writeFile(serverPath, source);
        if (input.source !== undefined) await writeServer(input.source);
        return {
          id: created.id,
          invoke: async <Result>(procedurePath: string) => {
            const result = await client.plugins.invoke({
              pluginId: created.id,
              path: procedurePath.split("."),
              input: undefined,
            });
            // SAFETY: each test supplies the return type of the procedure it wrote.
            return result as Result;
          },
          setCapabilities,
          writeServer,
        };
      },
    };

    await use(driver);
    const httpClosed = await closeHaloHttp(rpc.server);
    if (httpClosed instanceof Error) throw httpClosed;
    const sessionsClosed = await sessions.shutdown();
    if (sessionsClosed instanceof Error) throw sessionsClosed;
    const runtimeClosed = await toolRuntime.close();
    if (runtimeClosed instanceof Error) throw runtimeClosed;
    workspaceService.close();
    const filesystemClosed = await filesystemService.close();
    if (filesystemClosed instanceof Error) throw filesystemClosed;
    await fs.rm(userDataDir, { recursive: true, force: true });
  },
});

class TestCredentialVault implements CredentialVault {
  private readonly values = new Map<string, string>();

  async get(id: string) {
    return this.values.get(id);
  }

  async set(id: string, value: string) {
    this.values.set(id, value);
  }

  async delete(id: string) {
    this.values.delete(id);
  }
}

pluginTest(
  "creates, builds, invokes, and reloads a plugin",
  async ({ plugins }) => {
    expect(plugins.credentials.renderer).not.toBe(plugins.credentials.cli);
    expect(await plugins.rendererClient.server.info()).toEqual({
      protocolVersion: haloProtocolVersion,
    });
    await expect(plugins.unauthorizedClient.server.info()).rejects.toThrow();
    const notes = await plugins.create({
      id: "notes",
      capabilities: [],
      source: `import { pluginOs } from "@get-halo/plugin-sdk/server";

export default {
  ping: pluginOs.handler(({ context }) => ({ pluginId: context.pluginId })),
  count: pluginOs.handler(() => (async function* () {
    yield 1;
    yield 2;
  })()),
};
`,
    });

    await expect(notes.invoke("ping")).rejects.toThrow();
    await expect(
      plugins.client.plugins.create({ id: "notes" }),
    ).rejects.toThrow();
    await expect(
      plugins.client.plugins.create({ id: "new" }),
    ).rejects.toThrow();

    expect(await plugins.client.plugins.build()).toEqual({
      built: ["notes"],
      errors: [],
    });
    expect(await notes.invoke<{ pluginId: string }>("ping")).toEqual({
      pluginId: "notes",
    });

    const count = await notes.invoke<AsyncIterable<number>>("count");
    const values: unknown[] = [];
    for await (const value of count) values.push(value);
    expect(values).toEqual([1, 2]);

    await notes.writeServer(`import { pluginOs } from "@get-halo/plugin-sdk/server";

export default {
  ping: pluginOs.handler(() => ({ reloaded: true })),
};
`);
    await plugins.client.plugins.build();
    expect(await notes.invoke<{ reloaded: boolean }>("ping")).toEqual({
      reloaded: true,
    });
  },
  15_000,
);

pluginTest(
  "creates a storage plugin that typechecks",
  async ({ plugins }) => {
    await plugins.create({
      id: "items",
      capabilities: [],
      storage: true,
    });

    expect(await plugins.client.plugins.types()).toEqual({
      written: ["items"],
      diagnostics: [],
    });
  },
  15_000,
);

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
    await plugins.client.plugins.types();
    await plugins.client.plugins.build();

    const listed = await plugins.client.plugins.list();
    expect(listed.plugins.map((plugin) => plugin.id)).toContain("reader");
    expect(await plugins.client.plugins.check({ pluginId: reader.id })).toEqual(
      {
        requested: ["files.read"],
        existing: ["files.read"],
        granted: [],
        missing: [],
      },
    );
    expect(await reader.invoke<PluginToolResult>("read")).toMatchObject({
      ok: false,
      error: { code: "tool_not_granted" },
    });

    await plugins.client.plugins.grant({ pluginId: reader.id });
    expect(await reader.invoke<PluginToolResult>("read")).toEqual({
      ok: true,
      data: { path: "message.txt", text: "hello" },
    });

    await reader.setCapabilities([]);
    expect(await reader.invoke<PluginToolResult>("read")).toMatchObject({
      ok: false,
      error: { code: "tool_not_granted" },
    });

    await reader.setCapabilities(["files.read"]);
    expect(await reader.invoke<PluginToolResult>("read")).toMatchObject({
      ok: false,
      error: { code: "tool_not_granted" },
    });

    await plugins.client.plugins.grant({ pluginId: reader.id });
    expect(await reader.invoke<PluginToolResult>("read")).toEqual({
      ok: true,
      data: { path: "message.txt", text: "hello" },
    });
  },
  30_000,
);
