import type { Logger } from "@repo/logger";
import type { Server as HttpServer } from "node:http";
import { FilesystemService } from "./filesystem/FilesystemService.js";
import {
  closeHaloHttp,
  listenHaloHttp,
  type HaloHttpConnection,
  type HaloHttpError,
} from "./http.js";
import { PluginService } from "./plugins/PluginService.js";
import { PluginToolGrants } from "./plugins/PluginToolGrants.js";
import { type HaloContext } from "./router.js";
import { SessionRegistry } from "./sessions/SessionRegistry.js";
import { WorkspaceService } from "./workspace/WorkspaceService.js";
import { StaticAgentAuthority } from "./agent/runtime/AgentAuthority.js";
import type { CredentialVault } from "./agent/runtime/CredentialVault.js";
import { ToolRuntimeService } from "./agent/runtime/ToolRuntimeService.js";
import { workspaceBashPlugin } from "./agent/tools/bash/WorkspaceBashPlugin.js";
import { createWorkspaceFilesPlugin } from "./agent/tools/files/WorkspaceFilesPlugin.js";
import { parallelSearchPlugin } from "./agent/tools/web/ParallelSearchPlugin.js";

export type HaloServerOptions = {
  appDataDir: string;
  appVersion: string;
  cliEntry?: string;
  cliNodeExecutable?: string;
  cliElectronRunAsNode?: boolean;
  isDevelopment?: boolean;
  ownerUserId: Promise<string | Error>;
  logger: Logger;
  createCredentialVault: (input: {
    filesystem: FilesystemService;
    workspaceRoot: string;
  }) => CredentialVault;
};

export class HaloServer {
  private readonly context: HaloContext;
  private readonly filesystem: FilesystemService;
  private httpServer: HttpServer | undefined;

  constructor(options: HaloServerOptions) {
    const filesystem = new FilesystemService();
    const workspace = new WorkspaceService({
      appDataDir: options.appDataDir,
      filesystem,
      appVersion: options.appVersion,
      cliEntry: options.cliEntry,
      cliNodeExecutable: options.cliNodeExecutable,
      cliElectronRunAsNode: options.cliElectronRunAsNode,
      isDevelopment: options.isDevelopment,
    });
    const plugins = new PluginService({ filesystem, workspace });
    const pluginToolGrants = new PluginToolGrants({ filesystem, workspace });
    const toolRuntime = new ToolRuntimeService({
      filesystem,
      workspace,
      ownerUserId: options.ownerUserId,
      createCredentialVault: ({ workspaceRoot }) =>
        options.createCredentialVault({ filesystem, workspaceRoot }),
      toolPlugins: [
        createWorkspaceFilesPlugin(filesystem),
        workspaceBashPlugin,
        parallelSearchPlugin,
      ],
      authority: new StaticAgentAuthority([
        "workspace.files.read",
        "workspace.files.write",
        "workspace.shell.execute",
        "network.web.search",
      ]),
    });
    const sessions = new SessionRegistry({
      filesystem,
      workspace,
      toolRuntime,
    });

    this.filesystem = filesystem;
    this.context = {
      workspace,
      plugins,
      pluginToolGrants,
      sessions,
      toolRuntime,
      logger: options.logger,
    };
  }

  async listen(options: {
    host: string;
    port: number;
    corsOrigins: readonly string[];
  }): Promise<HaloHttpConnection | HaloHttpError> {
    await this.context.workspace.restore();
    if (this.context.workspace.getWorkspace() !== undefined) {
      const listed = await this.context.plugins.load();
      if (listed instanceof Error) {
        this.context.logger.warn({
          event: "plugin-startup-load-failed",
          error: listed,
        });
      }
    }

    const listening = await listenHaloHttp({
      context: this.context,
      host: options.host,
      port: options.port,
      corsOrigins: options.corsOrigins,
    });
    if (listening instanceof Error) return listening;
    this.httpServer = listening.server;
    return listening.connection;
  }

  getWorkspace() {
    return this.context.workspace.getWorkspace();
  }

  async selectWorkspace(directory: string) {
    const previous = this.context.workspace.getWorkspace();
    const selected = await this.context.workspace.select(directory);
    if (selected instanceof Error) return selected;
    if (
      previous !== undefined &&
      previous.workspaceRoot === selected.workspaceRoot
    ) {
      return selected;
    }

    const sessionsClosed = await this.context.sessions.shutdown();
    if (sessionsClosed instanceof Error) return sessionsClosed;
    const runtimeClosed = await this.context.toolRuntime.close();
    if (runtimeClosed instanceof Error) return runtimeClosed;

    const pluginsLoaded = await this.context.plugins.load();
    if (pluginsLoaded instanceof Error) {
      this.context.logger.warn({
        event: "plugin-workspace-load-failed",
        error: pluginsLoaded,
      });
    }
    return selected;
  }

  async close() {
    const httpClosed =
      this.httpServer === undefined
        ? undefined
        : await closeHaloHttp(this.httpServer);
    const sessionsClosed = await this.context.sessions.shutdown();
    const runtimeClosed = await this.context.toolRuntime.close();
    this.context.workspace.close();
    const filesystemClosed = await this.filesystem.close();

    if (httpClosed instanceof Error) return httpClosed;
    if (sessionsClosed instanceof Error) return sessionsClosed;
    if (runtimeClosed instanceof Error) return runtimeClosed;
    if (filesystemClosed instanceof Error) return filesystemClosed;
  }
}
