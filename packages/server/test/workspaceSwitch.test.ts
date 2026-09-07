import crypto from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { createHaloRpcClient } from "@halo/cli";
import { HaloServer } from "@get-halo/server";
import type { HaloClient } from "@get-halo/shared/contract";
import * as errore from "errore";
import { expect, test as baseTest } from "vitest";
import { createTestArtifacts } from "./TestArtifacts.js";
import { createServerOptions } from "./serverTest.js";

type SwitchServer = {
  halo: HaloServer;
  rpc: HaloClient;
  paths: { root: string; workspace: string; userData: string; logs: string };
};

const test = baseTest.extend<{ server: SwitchServer }>({
  server: async ({ task }, use) => {
    await using cleanup = new errore.AsyncDisposableStack();
    const artifacts = await createTestArtifacts(task.id);
    const outcome = { passed: false };
    cleanup.defer(() => artifacts.finish(outcome));

    const halo = new HaloServer({
      ...createServerOptions(artifacts),
      testingApiEnabled: true,
    });
    cleanup.defer(async () => {
      const closed = await halo.close();
      if (closed instanceof Error) {
        outcome.passed = false;
        throw closed;
      }
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

    await use({ halo, rpc, paths: artifacts.paths });
    outcome.passed = task.result?.state === "pass";
  },
});

test("selectWorkspace completes the switch even when a session's event log is unwritable", async ({
  server,
}) => {
  const created = await server.rpc.sessions.create();
  const sessionId = created.sessionId;
  const logPath = path.join(
    server.paths.workspace,
    ".pi",
    "agent",
    "sessions",
    `${sessionId}.halo-events.jsonl`,
  );

  await server.rpc.testHarness.appendSessionEvents({
    sessionId,
    events: [{ type: "run.started", runId: crypto.randomUUID() }],
  });
  expect(existsSync(logPath)).toBe(true);

  await fs.rm(logPath, { force: true });
  await fs.mkdir(logPath);

  await expect(
    server.rpc.testHarness.appendSessionEvents({
      sessionId,
      events: [{ type: "run.started", runId: crypto.randomUUID() }],
    }),
  ).rejects.toThrow();

  const nextWorkspace = path.join(server.paths.root, "workspace-b");
  await fs.mkdir(nextWorkspace, { recursive: true });

  const selected = await server.halo.selectWorkspace(nextWorkspace);

  expect(selected).not.toBeInstanceOf(Error);
  expect(server.halo.getWorkspace()?.workspaceRoot).toBe(nextWorkspace);

  await expect(server.rpc.sessions.create()).resolves.toEqual({
    sessionId: expect.any(String),
  });
}, 60_000);

test("HaloServer.close completes cleanup for a live session whose event log is unwritable", async ({
  server,
}) => {
  const created = await server.rpc.sessions.create();
  const sessionId = created.sessionId;
  const logPath = path.join(
    server.paths.workspace,
    ".pi",
    "agent",
    "sessions",
    `${sessionId}.halo-events.jsonl`,
  );

  await server.rpc.testHarness.appendSessionEvents({
    sessionId,
    events: [{ type: "run.started", runId: crypto.randomUUID() }],
  });
  await fs.rm(logPath, { force: true });
  await fs.mkdir(logPath);

  await expect(
    server.rpc.testHarness.appendSessionEvents({
      sessionId,
      events: [{ type: "run.started", runId: crypto.randomUUID() }],
    }),
  ).rejects.toThrow();
}, 60_000);
