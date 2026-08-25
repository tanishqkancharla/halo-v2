import { TandemClient } from "@tandem/core";
import { InMemoryRemote } from "@tandem/server";
import type { Logger } from "@repo/logger";
import type { IntegrationConnection } from "../shared/integrations.js";
import type { PluginList } from "../shared/plugin.js";
import type {
  AppInfo,
  SessionSummary,
  WorkspaceTreeEvent,
} from "../shared/rpc.js";
import {
  appInfoToRow,
  applyPathEvents,
  commitWrites,
  haloTables,
  pathRows,
  pathsFromRows,
  replaceCollection,
  sessionToRow,
  silentTandemLogger,
  workspaceToRow,
  type HaloSchema,
  type WorkspaceState,
} from "../shared/HaloTables.js";
import type { IntegrationService } from "./integrations/IntegrationService.js";
import type { PluginService } from "./plugins/PluginService.js";
import type { PiService } from "./sessions/PiService.js";
import type { WorkspaceService } from "./workspace/WorkspaceService.js";

const appInfoPollMs = 5_000;

export class HaloTandem {
  readonly remote = new InMemoryRemote<HaloSchema>();
  private readonly client = new TandemClient<HaloSchema>({
    schema: haloTables,
    remote: this.remote,
    autoConnect: false,
    syncInterval: 0,
    logger: silentTandemLogger,
  });
  private stopTreeListen: (() => void) | undefined;
  private stopIntegrations: (() => void) | undefined;
  private appInfoTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly pi: PiService,
    private readonly plugins: PluginService,
    private readonly integrations: IntegrationService,
    private readonly logger: Logger,
    private readonly readAppInfo: () => AppInfo,
  ) {}

  async start() {
    await this.client.ready;
    await this.client.connect();
    this.stopTreeListen = this.workspace.addTreeListener((events) => {
      void this.applyTreeEvents(events);
    });
    this.stopIntegrations = this.integrations.addChangeListener(() => {
      return this.refreshIntegrations();
    });
    this.appInfoTimer = setInterval(() => {
      void this.publishAppInfo(this.readAppInfo());
    }, appInfoPollMs);
    await this.refresh();
  }

  stop() {
    if (this.stopTreeListen !== undefined) this.stopTreeListen();
    this.stopTreeListen = undefined;
    if (this.stopIntegrations !== undefined) this.stopIntegrations();
    this.stopIntegrations = undefined;
    if (this.appInfoTimer !== undefined) clearInterval(this.appInfoTimer);
    this.appInfoTimer = undefined;
    void this.client.disconnect();
  }

  async refresh() {
    const workspace = this.workspace.getWorkspace();
    if (workspace === undefined) {
      await this.publishWorkspace({ status: "needs-workspace" });
      await this.publishSessions([]);
      await this.publishPaths([]);
      await this.publishPlugins({
        plugins: [],
        compiledViews: [],
        errors: [],
      });
      await this.publishIntegrations([]);
      await this.publishAppInfo(this.readAppInfo());
      return;
    }

    await this.publishWorkspace({ status: "ready", workspace });
    await this.publishAppInfo(this.readAppInfo());
    await this.refreshSessions();

    const paths = await this.workspace.listPaths();
    if (paths instanceof Error) {
      this.logger.warn({ event: "tandem-paths-failed", error: paths });
    } else {
      await this.publishPaths(paths);
    }

    await this.refreshPlugins();
    await this.refreshIntegrations();
  }

  async refreshSessions() {
    const sessions = await this.pi.listSessions();
    if (sessions instanceof Error) {
      this.logger.warn({ event: "tandem-sessions-failed", error: sessions });
      return;
    }
    await this.publishSessions(sessions);
  }

  async refreshPlugins() {
    const plugins = await this.plugins.list();
    if (plugins instanceof Error) {
      this.logger.warn({ event: "tandem-plugins-failed", error: plugins });
      return;
    }
    await this.publishPlugins(plugins);
  }

  async refreshIntegrations() {
    const integrations = await this.integrations.list();
    if (integrations instanceof Error) {
      this.logger.warn({
        event: "tandem-integrations-failed",
        error: integrations,
      });
      return;
    }
    await this.publishIntegrations(integrations);
  }

  async publishWorkspace(state: WorkspaceState) {
    await commitWrites(this.client, (tx) => {
      tx.set("workspaces", workspaceToRow(state));
    });
  }

  async publishSessions(sessions: SessionSummary[]) {
    await commitWrites(this.client, (tx) => {
      replaceCollection(tx, "sessions", sessions.map(sessionToRow));
    });
  }

  async publishPaths(paths: string[]) {
    await commitWrites(this.client, (tx) => {
      replaceCollection(tx, "workspacePaths", pathRows(paths));
    });
  }

  async publishAppInfo(info: AppInfo) {
    await commitWrites(this.client, (tx) => {
      tx.set("appInfos", appInfoToRow(info));
    });
  }

  async publishPlugins(list: PluginList) {
    await commitWrites(this.client, (tx) => {
      replaceCollection(
        tx,
        "plugins",
        list.plugins.map((plugin) => ({
          id: plugin.id,
          hasServer: plugin.serverPath !== undefined,
        })),
      );
      replaceCollection(tx, "pluginViews", list.compiledViews);
      replaceCollection(tx, "pluginErrors", list.errors);
    });
  }

  async publishIntegrations(connections: IntegrationConnection[]) {
    await commitWrites(this.client, (tx) => {
      replaceCollection(tx, "integrations", connections);
    });
  }

  private async applyTreeEvents(events: WorkspaceTreeEvent[]) {
    const current = pathsFromRows(
      this.client.query({ collection: "workspacePaths" }),
    );
    await this.publishPaths(applyPathEvents(current, events));
  }
}
