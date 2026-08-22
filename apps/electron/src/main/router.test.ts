import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Logger } from "@repo/logger";
import { ORPCError, call } from "@orpc/server";
import { describe, expect, test } from "vitest";
import { AgentSessionRegistry } from "./AgentSessionRegistry.js";
import { PiService } from "./pi-service.js";
import { PluginService } from "./plugins/PluginService.js";
import { router, type HaloContext } from "./router.js";
import { UserService } from "./UserService.js";
import {
  WorkspaceNotReadyError,
  WorkspaceService,
} from "./workspace-service.js";

const routerTest = test.extend<{
  appDataDir: string;
  workspaceRoot: string;
  context: HaloContext;
}>({
  appDataDir: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-app-${task.id}-`));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
  workspaceRoot: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-ws-${task.id}-`));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
  context: async ({ appDataDir }, use) => {
    const workspace = new WorkspaceService(appDataDir);
    await use({
      workspace,
      pi: new PiService(workspace, new UserService(appDataDir)),
      plugins: new PluginService(workspace),
      sessions: new AgentSessionRegistry(),
      getWindow: () => {
        throw new Error("no window");
      },
      logger: new Logger(),
    });
  },
});

describe("router", () => {
  routerTest(
    "getWorkspace is undefined until a workspace is selected",
    async ({ context, workspaceRoot }) => {
      const before = await call(router.getWorkspace, undefined, { context });
      expect(before).toBeUndefined();

      const selected = await context.workspace.select(workspaceRoot);
      if (selected instanceof Error) throw selected;

      const after = await call(router.getWorkspace, undefined, { context });
      expect(after).toEqual({
        name: basename(selected.workspaceRoot),
        workspaceRoot: selected.workspaceRoot,
      });
    },
  );

  routerTest(
    "listPlugins fails with WorkspaceNotReadyError before a workspace is chosen",
    async ({ context }) => {
      const listed = await call(router.listPlugins, undefined, {
        context,
      }).then(
        () => {
          throw new Error("listPlugins succeeded");
        },
        (error: Error) => error,
      );
      expect(listed).toBeInstanceOf(ORPCError);
      expect(listed.cause).toBeInstanceOf(WorkspaceNotReadyError);
    },
  );
});
