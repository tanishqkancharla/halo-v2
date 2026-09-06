import { createHaloRpcClient } from "@halo/cli";
import fs from "node:fs/promises";
import path from "node:path";
import outdent from "outdent";
import * as errore from "errore";
import { test, expect } from "vitest";
import { HaloServer, type HaloServerOptions } from "@get-halo/server";
import {
  copyPluginWorkspacePackages,
  installPluginSdkContract,
} from "@get-halo/server/plugins";
import type { HaloClient } from "@get-halo/shared/contract";
import { TemporaryCredentialVault } from "./TemporaryCredentialVault.js";
import { createTestArtifacts } from "./TestArtifacts.js";

const testAppVersion = "0.0.0-test";

function createServerOptions(
  artifacts: Awaited<ReturnType<typeof createTestArtifacts>>,
): HaloServerOptions {
  return {
    appDataDir: artifacts.paths.userData,
    appVersion: testAppVersion,
    ownerUserId: Promise.resolve("server-test-user"),
    logger: artifacts.logger,
    pluginDependencyInstaller: async (directory) => {
      const contract = await installPluginSdkContract({
        directory,
        appVersion: testAppVersion,
      });
      if (contract instanceof Error) return contract;
      return copyPluginWorkspacePackages(directory);
    },
    createCredentialVault: ({ filesystem, workspaceRoot }) =>
      new TemporaryCredentialVault({
        filesystem,
        directory: path.join(workspaceRoot, ".halo", "executor", "credentials"),
      }),
  };
}

async function setupMarkerPlugin(
  rpc: HaloClient,
  harness: Awaited<ReturnType<typeof createTestArtifacts>>["harness"],
  marker: string,
  slow: boolean,
) {
  const plugin = await rpc.plugins.create({ id: "p" });
  const topAwait = slow
    ? outdent`
        await new Promise((resolve) => setTimeout(resolve, 200));
      `
    : "";
  await harness.files.write({
    path: path.join(plugin.directory, "server.ts"),
    content: outdent`
      import { pluginOs } from "@get-halo/plugin-sdk/server";

      ${topAwait}

      export default {
        ping: pluginOs.handler(() => ({ workspace: "${marker}" })),
      };
    `,
  });
  await rpc.plugins.build();
}

test("stale routers through HaloServer.selectWorkspace", async ({ task }) => {
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

  const workspaceA = artifacts.paths.workspace;
  const workspaceB = path.join(artifacts.paths.root, "workspace-b");
  await fs.mkdir(workspaceB, { recursive: true });

  const selectedA = await halo.selectWorkspace(workspaceA);
  if (selectedA instanceof Error) throw selectedA;

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

  await setupMarkerPlugin(rpc, artifacts.harness, "A", false);
  expect(
    await rpc.plugins.invoke({
      pluginId: "p",
      path: ["ping"],
      input: undefined,
    }),
  ).toEqual({ workspace: "A" });

  const selectedB = await halo.selectWorkspace(workspaceB);
  if (selectedB instanceof Error) throw selectedB;
  await setupMarkerPlugin(rpc, artifacts.harness, "B", true);

  await halo.selectWorkspace(workspaceA);
  expect(
    await rpc.plugins.invoke({
      pluginId: "p",
      path: ["ping"],
      input: undefined,
    }),
  ).toEqual({ workspace: "A" });

  const switchPromise = halo.selectWorkspace(workspaceB);
  while (halo.getWorkspace()?.workspaceRoot !== selectedB.workspaceRoot) {
    await new Promise((resolve) => void setTimeout(resolve, 1));
  }

  await expect(
    rpc.plugins.invoke({
      pluginId: "p",
      path: ["ping"],
      input: undefined,
    }),
  ).rejects.toThrow("Plugin 'p' is not mounted");

  await switchPromise;
  expect(
    await rpc.plugins.invoke({
      pluginId: "p",
      path: ["ping"],
      input: undefined,
    }),
  ).toEqual({ workspace: "B" });

  outcome.passed = true;
}, 60_000);

test("re-selecting the same workspace keeps plugins mounted", async ({
  task,
}) => {
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

  await setupMarkerPlugin(rpc, artifacts.harness, "A", false);
  expect(
    await rpc.plugins.invoke({
      pluginId: "p",
      path: ["ping"],
      input: undefined,
    }),
  ).toEqual({ workspace: "A" });

  const reselected = await halo.selectWorkspace(artifacts.paths.workspace);
  if (reselected instanceof Error) throw reselected;

  expect(
    await rpc.plugins.invoke({
      pluginId: "p",
      path: ["ping"],
      input: undefined,
    }),
  ).toEqual({ workspace: "A" });

  outcome.passed = true;
}, 30_000);
