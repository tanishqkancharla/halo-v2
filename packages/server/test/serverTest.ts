import { createHaloRpcClient } from "@halo/cli";
import { HaloServer, type HaloServerOptions } from "@get-halo/server";
import type { HaloClient } from "@get-halo/shared/contract";
import path from "node:path";
import * as errore from "errore";
import { test as baseTest } from "vitest";
import { TemporaryCredentialVault } from "./TemporaryCredentialVault.js";
import {
  createTestArtifacts,
  type TestArtifacts,
  type TestHarness,
} from "./TestArtifacts.js";

const testAppVersion = "0.0.0-test";

type TestServer = {
  host: string;
  port: number;
  rpc: HaloClient;
  rendererRpc: HaloClient;
  harness: TestHarness;
  close(): Promise<void>;
};

export const serverTest = baseTest.extend<{
  server: TestServer;
  startServer: (workspaceRoot?: string, port?: number) => Promise<TestServer>;
}>({
  server: async ({ startServer }, use) => use(await startServer()),
  startServer: async ({ task }, use) => {
    await using cleanup = new errore.AsyncDisposableStack();
    const artifacts = await createTestArtifacts(task.id);
    const outcome = { passed: false };
    cleanup.defer(() => artifacts.finish(outcome));

    await use(async (workspaceRoot = artifacts.paths.workspace, port = 0) => {
      const resources = new errore.AsyncDisposableStack();
      cleanup.defer(() => resources.disposeAsync());
      const halo = await HaloServer.start({
        ...createServerOptions(artifacts),
        workspaceRoot,
        host: "127.0.0.1",
        port,
        corsOrigins: [],
      });
      if (halo instanceof Error) throw halo;
      resources.defer(async () => {
        const closed = await halo.close();
        if (!(closed instanceof Error)) return;
        outcome.passed = false;
        throw closed;
      });
      const connection = halo.connections;
      return {
        host: connection.cli.host,
        port: connection.cli.port,
        rpc: createHaloRpcClient<HaloClient>({
          version: 1,
          ...connection.cli,
          host: "127.0.0.1",
        }),
        rendererRpc: createHaloRpcClient<HaloClient>({
          version: 1,
          ...connection.renderer,
          host: "127.0.0.1",
        }),
        harness: artifacts.harness,
        close: () => resources.disposeAsync(),
      };
    });
    outcome.passed = task.result?.state === "pass";
  },
});

function createServerOptions(
  artifacts: TestArtifacts,
): Omit<HaloServerOptions, "workspaceRoot"> {
  return {
    appDataDir: artifacts.paths.userData,
    appVersion: testAppVersion,
    ownerUserId: Promise.resolve("server-test-user"),
    logger: artifacts.logger,
    createCredentialVault: ({ filesystem, workspaceRoot }) =>
      new TemporaryCredentialVault({
        filesystem,
        directory: path.join(workspaceRoot, ".halo", "executor", "credentials"),
      }),
  };
}
