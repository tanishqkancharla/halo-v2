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

type TestServer = {
  rpc: HaloClient;
  harness: TestHarness;
};

export const serverTest = baseTest.extend<{ server: TestServer }>({
  server: async ({ task }, use) => {
    await using cleanup = new errore.AsyncDisposableStack();
    const artifacts = await createTestArtifacts(task.id);
    const outcome = { passed: false };
    cleanup.defer(() => artifacts.finish(outcome));

    const halo = new HaloServer(createServerOptions(artifacts));
    cleanup.defer(async () => {
      const closed = await halo.close();
      if (!(closed instanceof Error)) return;
      outcome.passed = false;
      throw closed;
    });

    const selected = await halo.selectWorkspace(artifacts.paths.workspace);
    if (selected instanceof Error) throw selected;

    const connection = await halo.listen({
      host: "127.0.0.1",
      port: 0,
      corsOrigins: [],
    });
    if (connection instanceof Error) throw connection;

    const rpc = createHaloRpcClient<HaloClient>({
      version: 1,
      host: "127.0.0.1",
      port: connection.cli.port,
      token: connection.cli.token,
    });
    await use({ rpc, harness: artifacts.harness });
    outcome.passed = task.result?.state === "pass";
  },
});

function createServerOptions(artifacts: TestArtifacts): HaloServerOptions {
  return {
    appDataDir: artifacts.paths.userData,
    appVersion: "0.0.0-test",
    ownerUserId: Promise.resolve("server-test-user"),
    logger: artifacts.logger,
    createCredentialVault: ({ filesystem, workspaceRoot }) =>
      new TemporaryCredentialVault({
        filesystem,
        directory: path.join(workspaceRoot, ".halo", "executor", "credentials"),
      }),
  };
}
