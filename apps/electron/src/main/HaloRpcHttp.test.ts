import { existsSync } from "node:fs";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  createHaloRpcClient,
  readHaloRpcFile,
  rpcFilePath,
} from "@get-halo/cli";
import { FilesystemService, HaloServer } from "@get-halo/server";
import { Logger } from "@get-halo/logger";
import { describe, expect, test } from "vitest";
import type { HaloClient } from "@get-halo/shared/contract";
import { ElectronServerHost } from "./ElectronServerHost.js";
import { listenHaloRpcHttp, type HaloRpcHttp } from "./HaloRpcHttp.js";

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
    const filesystem = new FilesystemService();
    await writeFile(
      join(userDataDir, "workspace.json"),
      `${JSON.stringify({ workspaceRoot })}\n`,
    );
    const server = new HaloServer({
      appDataDir: userDataDir,
      appVersion: "0.0.0",
      filesystem,
      host: new ElectronServerHost(),
      logger: new Logger(),
    });
    await server.start();
    const rpc = await listenHaloRpcHttp({
      context: server.context,
      router: server.router,
      filesystem,
      userDataDir,
    });
    if (rpc instanceof Error) throw rpc;
    await use(rpc);
    await rpc.close();
    await server.close();
  },
});

describe("listenHaloRpcHttp", () => {
  rpcHttpTest(
    "writes rpc.json and serves transport-neutral server state",
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
      await expect(client.getServerInfo()).resolves.toEqual({
        version: "0.0.0",
      });
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
});
