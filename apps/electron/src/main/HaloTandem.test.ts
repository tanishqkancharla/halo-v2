import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { TandemClient } from "@tandem/core";
import { Logger } from "@repo/logger";
import { describe, expect, test } from "vitest";
import {
  haloTables,
  silentTandemLogger,
  workspaceFromRow,
  type HaloSchema,
} from "../shared/HaloTables.js";
import { HaloTandem } from "./HaloTandem.js";
import { IntegrationService } from "./integrations/IntegrationService.js";
import { PluginService } from "./plugins/PluginService.js";
import { PiService } from "./sessions/PiService.js";
import { UserService } from "./UserService.js";
import { WorkspaceService } from "./workspace/WorkspaceService.js";

const tandemTest = test.extend<{
  userDataDir: string;
  workspaceRoot: string;
  workspace: WorkspaceService;
  integrations: IntegrationService;
  tandem: HaloTandem;
  replica: TandemClient<HaloSchema>;
}>({
  userDataDir: async ({ task }, use) => {
    const directory = await mkdtemp(
      join(tmpdir(), `halo-tandem-user-${task.id}-`),
    );
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
  workspaceRoot: async ({ task }, use) => {
    const directory = await mkdtemp(
      join(tmpdir(), `halo-tandem-ws-${task.id}-`),
    );
    await writeFile(join(directory, "README.md"), "hello\n");
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
  workspace: async ({ userDataDir, workspaceRoot }, use) => {
    const workspace = new WorkspaceService(userDataDir);
    const selected = await workspace.select(workspaceRoot);
    if (selected instanceof Error) throw selected;
    await use(workspace);
  },
  integrations: async ({ workspace }, use) => {
    await use(new IntegrationService(workspace));
  },
  tandem: async ({ userDataDir, workspace, integrations }, use) => {
    const tandem = new HaloTandem(
      workspace,
      new PiService(workspace, new UserService(userDataDir), integrations),
      new PluginService(workspace),
      integrations,
      new Logger(),
      () => ({
        version: "0.0.0",
        update: { state: "disabled", reason: "test" },
      }),
    );
    await tandem.start();
    await use(tandem);
    tandem.stop();
  },
  replica: async ({ tandem }, use) => {
    const replica = new TandemClient<HaloSchema>({
      schema: haloTables,
      remote: tandem.remote,
      autoConnect: false,
      syncInterval: 0,
      logger: silentTandemLogger,
    });
    await replica.ready;
    await replica.connect();
    await use(replica);
    await replica.disconnect();
  },
});

describe("HaloTandem", () => {
  tandemTest(
    "replica pulls workspace, paths, and app info written by the host",
    async ({ replica, workspaceRoot }) => {
      replica.subscribe({ collection: "workspaces" }, () => {});
      replica.subscribe({ collection: "workspacePaths" }, () => {});
      replica.subscribe({ collection: "appInfos" }, () => {});
      await replica.pullFromRemote();

      const resolvedRoot = await realpath(workspaceRoot);
      const workspace = replica.query({ collection: "workspaces" })[0];
      expect(workspaceFromRow(workspace!)).toEqual({
        status: "ready",
        workspace: {
          name: basename(resolvedRoot),
          workspaceRoot: resolvedRoot,
        },
      });
      expect(
        replica.query({ collection: "workspacePaths" }).map((row) => row.id),
      ).toContain("README.md");
      expect(replica.query({ collection: "appInfos" })[0]?.id).toBe("current");
    },
  );

  tandemTest(
    "publishing a pending integration reaches a subscribed replica",
    async ({ replica, integrations }) => {
      replica.subscribe({ collection: "integrations" }, () => {});
      await replica.pullFromRemote();
      expect(replica.query({ collection: "integrations" })).toEqual([]);

      const pending = await integrations.createPending({
        service: "gmail",
        profile: "default",
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        intent: "connect",
      });
      if (pending instanceof Error) throw pending;
      await replica.pullFromRemote();
      expect(replica.query({ collection: "integrations" })).toEqual([pending]);
    },
  );
});
