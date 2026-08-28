import { existsSync } from "node:fs";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createHaloRpcClient, readHaloRpcFile, rpcFilePath } from "@halo/cli";
import { Logger } from "@repo/logger";
import { describe, expect, test } from "vitest";
import type { HaloClient } from "../shared/contract.js";
import { StaticAgentAuthority } from "./agent/runtime/AgentAuthority.js";
import { ToolRuntimeService } from "./agent/runtime/ToolRuntimeService.js";
import { listenHaloRpcHttp, type HaloRpcHttp } from "./HaloRpcHttp.js";
import { PluginService } from "./plugins/PluginService.js";
import type { HaloContext } from "./router.js";
import { SessionRegistry } from "./sessions/SessionRegistry.js";
import { UserService } from "./UserService.js";
import { WorkspaceService } from "./workspace/WorkspaceService.js";

const rpcHttpTest = test.extend<{
  userDataDir: string;
  workspaceRoot: string;
  rpc: HaloRpcHttp;
}>({
  userDataDir: async ({ task }, use) => {
    const directory = await mkdtemp(
      join(tmpdir(), `halo-rpc-user-${task.id}-`),
    );
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
  workspaceRoot: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-rpc-ws-${task.id}-`));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
  rpc: async ({ userDataDir, workspaceRoot }, use) => {
    const workspace = new WorkspaceService(userDataDir);
    await writeFile(
      join(userDataDir, "workspace.json"),
      `${JSON.stringify({ workspaceRoot })}\n`,
    );
    const restored = await workspace.restore();
    if (restored === undefined) {
      throw new Error("workspace restore returned undefined");
    }

    const user = new UserService(userDataDir);
    const toolRuntime = new ToolRuntimeService({
      workspace,
      user,
      toolPluginFactories: [],
      authority: new StaticAgentAuthority([]),
    });
    const sessions = new SessionRegistry({ workspace, toolRuntime });
    const context: HaloContext = {
      workspace,
      sessions,
      toolRuntime,
      plugins: new PluginService(workspace),
      getWindow: () => {
        throw new Error("Halo main window is not open.");
      },
      logger: new Logger(),
    };
    const rpc = await listenHaloRpcHttp({ context, userDataDir });
    if (rpc instanceof Error) throw rpc;
    await use(rpc);
    await rpc.close();
    const sessionsClosed = await sessions.shutdown();
    if (sessionsClosed instanceof Error) throw sessionsClosed;
    const runtimeClosed = await toolRuntime.close();
    if (runtimeClosed instanceof Error) throw runtimeClosed;
  },
});

describe("listenHaloRpcHttp", () => {
  rpcHttpTest(
    "writes rpc.json and serves workspace.get",
    async ({ rpc, userDataDir, workspaceRoot }) => {
      const file = await readHaloRpcFile(rpcFilePath(userDataDir));
      if (file instanceof Error) throw file;

      expect(file.host).toBe("127.0.0.1");
      expect(file.port).toBe(rpc.port);
      expect(file.token).toBe(rpc.token);
      expect(rpc.oauthRedirectUri).toBe(
        `http://127.0.0.1:${rpc.port}/oauth/callback`,
      );

      const client = createHaloRpcClient<HaloClient>(file);
      const workspace = await client.workspace.get();
      const resolvedRoot = await realpath(workspaceRoot);
      expect(workspace).toEqual({
        name: basename(resolvedRoot),
        workspaceRoot: resolvedRoot,
      });
    },
  );

  rpcHttpTest("rejects a request without the token", async ({ rpc }) => {
    const response = await fetch(
      `http://127.0.0.1:${rpc.port}/rpc/workspace/get`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    expect(response.status).toBe(401);
  });

  rpcHttpTest(
    "accepts OAuth callbacks without the RPC token",
    async ({ rpc }) => {
      const missing = await fetch(rpc.oauthRedirectUri);
      expect(missing.status).toBe(400);
      expect(await missing.text()).toBe("Missing OAuth callback parameters.");

      const unknown = await fetch(`${rpc.oauthRedirectUri}?state=x&code=y`);
      expect(unknown.status).toBe(400);
      expect(await unknown.text()).toBe(
        "Authorization could not be completed.",
      );
    },
  );

  rpcHttpTest("unlinks rpc.json on close", async ({ rpc, userDataDir }) => {
    const path = rpcFilePath(userDataDir);
    expect(existsSync(path)).toBe(true);
    await rpc.close();
    expect(existsSync(path)).toBe(false);
  });

  rpcHttpTest(
    "creates, builds, and calls a plugin over HTTP",
    async ({ rpc, userDataDir }) => {
      expect(rpc.port).toBeGreaterThan(0);
      const file = await readHaloRpcFile(rpcFilePath(userDataDir));
      if (file instanceof Error) throw file;
      const client = createHaloRpcClient<HaloClient>(file);

      const created = await client.plugins.create({ id: "notes" });
      expect(created.id).toBe("notes");

      const beforeBuild = await client.plugins
        .invoke({
          pluginId: "notes",
          path: ["ping"],
          input: undefined,
        })
        .catch((e) => (e instanceof Error ? e : new Error(String(e))));
      expect(beforeBuild).toBeInstanceOf(Error);

      await writeFile(
        join(created.directory, "server.ts"),
        `import { pluginOs } from "@get-halo/plugin-sdk/server";

export default {
  ping: pluginOs.handler(async ({ context }) => ({
    pluginId: context.pluginId,
  })),
  count: pluginOs.handler(() => (async function* () {
    yield 1;
    yield 2;
  })()),
};
`,
      );

      const reserved = await client.plugins
        .create({ id: "new" })
        .catch((e) => (e instanceof Error ? e : new Error(String(e))));
      expect(reserved).toBeInstanceOf(Error);

      const built = await client.plugins.build();
      expect(built.built).toEqual(["notes"]);
      expect(built.errors).toEqual([]);

      const ping = await client.plugins.invoke({
        pluginId: "notes",
        path: ["ping"],
        input: undefined,
      });
      expect(ping).toEqual({ pluginId: "notes" });

      const count = await client.plugins.invoke({
        pluginId: "notes",
        path: ["count"],
        input: undefined,
      });
      expect(count).toBeInstanceOf(Object);
      // SAFETY: the test plugin's count procedure returns an async number iterator.
      const stream = count as AsyncIterable<number>;
      const values: unknown[] = [];
      for await (const value of stream) values.push(value);
      expect(values).toEqual([1, 2]);

      await writeFile(
        join(created.directory, "server.ts"),
        `import { pluginOs } from "@get-halo/plugin-sdk/server";

export default {
  ping: pluginOs.handler(async ({ context }) => ({
    pluginId: context.pluginId,
    reloaded: true,
  })),
};
`,
      );
      await client.plugins.build();

      const reloaded = await client.plugins.invoke({
        pluginId: "notes",
        path: ["ping"],
        input: undefined,
      });
      expect(reloaded).toEqual({ pluginId: "notes", reloaded: true });
    },
  );
});
