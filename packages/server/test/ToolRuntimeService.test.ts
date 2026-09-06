import path from "node:path";
import * as errore from "errore";
import { expect, test as baseTest } from "vitest";
import { StaticAgentAuthority } from "../src/agent/runtime/AgentAuthority.js";
import { ToolRuntimeService } from "../src/agent/runtime/ToolRuntimeService.js";
import { FilesystemService } from "../src/filesystem/FilesystemService.js";
import { WorkspaceService } from "../src/workspace/WorkspaceService.js";
import { createTestArtifacts } from "./TestArtifacts.js";
import { TemporaryCredentialVault } from "./TemporaryCredentialVault.js";

const test = baseTest.extend<{ toolRuntime: ToolRuntimeService }>({
  toolRuntime: async ({ task }, use) => {
    const artifacts = await createTestArtifacts(task.id);
    await using cleanup = new errore.AsyncDisposableStack();
    cleanup.defer(() =>
      artifacts.finish({ passed: task.result?.state === "pass" }),
    );

    const filesystem = new FilesystemService();
    cleanup.defer(async () => {
      const closed = await filesystem.close();
      if (closed instanceof Error) throw closed;
    });

    const workspace = new WorkspaceService({
      appDataDir: artifacts.paths.userData,
      filesystem,
      appVersion: "0.0.0-test",
    });
    const selected = await workspace.select(artifacts.paths.workspace);
    if (selected instanceof Error) throw selected;
    cleanup.defer(() => workspace.close());

    const service = new ToolRuntimeService({
      filesystem,
      workspace,
      ownerUserId: Promise.resolve("server-test-user"),
      createCredentialVault: ({ workspaceRoot }) =>
        new TemporaryCredentialVault({
          filesystem,
          directory: path.join(
            workspaceRoot,
            ".halo",
            "executor",
            "credentials",
          ),
        }),
      toolPlugins: [],
      authority: new StaticAgentAuthority([
        "workspace.files.read",
        "workspace.files.write",
        "workspace.shell.execute",
        "network.web.search",
      ]),
    });
    cleanup.defer(async () => {
      const closed = await service.close();
      if (closed instanceof Error) throw closed;
    });

    await use(service);
  },
});

test("shares a single runtime across concurrent get() calls", async ({
  toolRuntime: service,
}) => {
  // Precondition: network access — ToolRuntime.create installs Google
  // integration presets by fetching Google's discovery API on first boot.
  const [first, second] = await Promise.all([service.get(), service.get()]);
  expect(first).not.toBeInstanceOf(Error);
  expect(second).not.toBeInstanceOf(Error);
  expect(first).toBe(second);

  // A later caller reuses the cached runtime without rebuilding.
  const reused = await service.get();
  expect(reused).toBe(first);
}, 60_000);

test("rebuilds the runtime after close() and dedupes the next cold boot", async ({
  toolRuntime: service,
}) => {
  // Precondition: network access — ToolRuntime.create installs Google
  // integration presets by fetching Google's discovery API on first boot.
  const initial = await service.get();
  expect(initial).not.toBeInstanceOf(Error);
  const closed = await service.close();
  expect(closed).not.toBeInstanceOf(Error);

  const [reopened, concurrent] = await Promise.all([
    service.get(),
    service.get(),
  ]);
  expect(reopened).not.toBeInstanceOf(Error);
  expect(concurrent).not.toBeInstanceOf(Error);
  expect(reopened).toBe(concurrent);
  expect(reopened).not.toBe(initial);
}, 60_000);
