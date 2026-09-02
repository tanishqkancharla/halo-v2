import type { Logger } from "@get-halo/logger";
import { StaticAgentAuthority } from "./agent/runtime/AgentAuthority.js";
import { ToolRuntimeService } from "./agent/runtime/ToolRuntimeService.js";
import { workspaceBashPlugin } from "./agent/tools/bash/WorkspaceBashPlugin.js";
import { createWorkspaceFilesPlugin } from "./agent/tools/files/WorkspaceFilesPlugin.js";
import { parallelSearchPlugin } from "./agent/tools/web/ParallelSearchPlugin.js";
import { FilesystemService } from "./filesystem/FilesystemService.js";
import { PluginService } from "./plugins/PluginService.js";
import { PluginToolGrants } from "./plugins/PluginToolGrants.js";
import { haloRpcRouter, type HaloContext } from "./router.js";
import type { ServerHost } from "./ServerHost.js";
import { SessionRegistry } from "./sessions/SessionRegistry.js";
import { UserService } from "./UserService.js";
import { WorkspaceService } from "./workspace/WorkspaceService.js";

export type HaloServerOptions = {
  appDataDir: string;
  appVersion: string;
  cliEntry?: string;
  cliNodeExecutable?: string;
  cliElectronRunAsNode?: boolean;
  isDevelopment?: boolean;
  filesystem: FilesystemService;
  host: ServerHost;
  logger: Logger;
};

export class HaloServer {
  readonly router = haloRpcRouter;
  readonly context: HaloContext;

  private readonly filesystem: FilesystemService;
  private readonly workspace: WorkspaceService;
  private readonly plugins: PluginService;
  private readonly sessions: SessionRegistry;
  private readonly toolRuntime: ToolRuntimeService;
  private readonly logger: Logger;

  constructor(options: HaloServerOptions) {
    this.filesystem = options.filesystem;
    this.logger = options.logger;
    this.workspace = new WorkspaceService({
      appDataDir: options.appDataDir,
      filesystem: this.filesystem,
      appVersion: options.appVersion,
      cliEntry: options.cliEntry,
      cliNodeExecutable: options.cliNodeExecutable,
      cliElectronRunAsNode: options.cliElectronRunAsNode,
      isDevelopment: options.isDevelopment,
    });
    const user = new UserService({
      appDataDir: options.appDataDir,
      filesystem: this.filesystem,
    });
    const toolPlugins = [
      createWorkspaceFilesPlugin(this.filesystem),
      workspaceBashPlugin,
      parallelSearchPlugin,
    ];
    const authority = new StaticAgentAuthority([
      "workspace.files.read",
      "workspace.files.write",
      "workspace.shell.execute",
      "network.web.search",
    ]);
    this.plugins = new PluginService({
      filesystem: this.filesystem,
      workspace: this.workspace,
    });
    const pluginToolGrants = new PluginToolGrants({
      filesystem: this.filesystem,
      workspace: this.workspace,
    });
    this.toolRuntime = new ToolRuntimeService({
      filesystem: this.filesystem,
      workspace: this.workspace,
      user,
      toolPlugins,
      authority,
      host: options.host,
    });
    this.sessions = new SessionRegistry({
      filesystem: this.filesystem,
      workspace: this.workspace,
      toolRuntime: this.toolRuntime,
    });
    this.context = {
      workspace: this.workspace,
      plugins: this.plugins,
      pluginToolGrants,
      sessions: this.sessions,
      toolRuntime: this.toolRuntime,
      host: options.host,
      logger: this.logger,
    };
  }

  async start() {
    await this.workspace.restore();
    if (this.workspace.getWorkspace() === undefined) return;
    const listed = await this.plugins.list();
    if (listed instanceof Error) {
      this.logger.warn({ event: "plugin-startup-load-failed", error: listed });
    }
  }

  setOAuthRedirectUri(uri: string) {
    this.toolRuntime.setOAuthRedirectUri(uri);
  }

  getWorkspace() {
    return this.workspace.getWorkspace();
  }

  async selectWorkspace(directory: string) {
    const previous = this.workspace.getWorkspace();
    const workspace = await this.workspace.select(directory);
    if (workspace instanceof Error) return workspace;
    if (
      previous !== undefined &&
      previous.workspaceRoot === workspace.workspaceRoot
    ) {
      return workspace;
    }

    const sessionsClosed = await this.sessions.shutdown();
    if (sessionsClosed instanceof Error) {
      this.logger.error({
        event: "session-registry-workspace-close-failed",
        error: sessionsClosed,
      });
    }
    const runtimeClosed = await this.toolRuntime.close();
    if (runtimeClosed instanceof Error) {
      this.logger.error({
        event: "tool-runtime-workspace-close-failed",
        error: runtimeClosed,
      });
    }
    return workspace;
  }

  async close() {
    const sessionsClosed = await this.sessions.shutdown();
    if (sessionsClosed instanceof Error) {
      this.logger.error({
        event: "session-registry-close-failed",
        error: sessionsClosed,
      });
    }
    const runtimeClosed = await this.toolRuntime.close();
    if (runtimeClosed instanceof Error) {
      this.logger.error({
        event: "tool-runtime-close-failed",
        error: runtimeClosed,
      });
    }
    this.workspace.close();
    const filesystemClosed = await this.filesystem.close();
    if (filesystemClosed instanceof Error) {
      this.logger.error({
        event: "filesystem-close-failed",
        error: filesystemClosed,
      });
    }
  }
}

export { FilesystemService } from "./filesystem/FilesystemService.js";
export type { ServerHost } from "./ServerHost.js";
