import { existsSync } from "node:fs";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  callPluginProcedure,
  createHaloRpcClient,
  readHaloRpcFile,
  rpcFilePath,
  type PluginRouter,
} from "@halo/cli";
import { Logger } from "@repo/logger";
import { describe, expect, test } from "vitest";
import type { HaloClient } from "../shared/contract.js";
import { listenHaloRpcHttp, type HaloRpcHttp } from "./HaloRpcHttp.js";
import { IntegrationService } from "./integrations/IntegrationService.js";
import { PluginService } from "./plugins/PluginService.js";
import type { HaloContext } from "./router.js";
import { AgentSessionRegistry } from "./sessions/AgentSessionRegistry.js";
import { PiService } from "./sessions/PiService.js";
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

    const integrations = new IntegrationService(workspace);
    const context: HaloContext = {
      workspace,
      integrations,
      pi: new PiService(workspace, new UserService(userDataDir), integrations),
      plugins: new PluginService(workspace),
      sessions: new AgentSessionRegistry(),
      getWindow: () => {
        throw new Error("Halo main window is not open.");
      },
      logger: new Logger(),
    };
    const rpc = await listenHaloRpcHttp({ context, userDataDir });
    if (rpc instanceof Error) throw rpc;
    await use(rpc);
    await rpc.close();
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

      const reserved = await client.plugins
        .create({ id: "new" })
        .catch((e) => (e instanceof Error ? e : new Error(String(e))));
      expect(reserved).toBeInstanceOf(Error);

      const built = await client.plugins.build();
      expect(built.built).toEqual(["notes"]);
      expect(built.errors).toEqual([]);

      const ping = await callPluginProcedure({
        // SAFETY: HaloClient.plugins.servers is the mounted oRPC plugin tree.
        client: { plugins: client.plugins.servers as PluginRouter },
        id: "notes",
        path: ["ping"],
        input: undefined,
      });
      expect(ping).toEqual({ pluginId: "notes" });
    },
  );
});
