import {
  BrowserService,
  type AppBrowserTarget,
} from "./browser/BrowserService.js";
import type { Logger } from "@repo/logger";
import type { Server as HttpServer } from "node:http";
import { FilesystemService } from "./filesystem/FilesystemService.js";
import {
  closeHaloHttp,
  listenHaloHttp,
  type HaloHttpConnections,
  type HaloHttpError,
} from "./http.js";
import { ExtensionHost } from "./extensions/ExtensionHost.js";
import { ExtensionTools } from "./extensions/ExtensionTools.js";
import type { ExtensionRuntime } from "./extensions/ExtensionProcess.js";
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
  appBrowserTarget?: AppBrowserTarget;
  appDataDir: string;
  appVersion: string;
  cliEntry?: string;
  cliNodeExecutable?: string;
  cliElectronRunAsNode?: boolean;
  extensionRuntime?: ExtensionRuntime;
  testingApiEnabled?: boolean;
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
    });
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
      browsers: new BrowserService(options.appBrowserTarget),
      browserControlAllowed: false,
      extensionApprovalAllowed: false,
      extensionTools: new ExtensionTools({
        filesystem,
        workspace,
        toolRuntime,
      }),
      extensions: new ExtensionHost({
        filesystem,
        logger: options.logger,
        runtime:
          options.extensionRuntime === undefined
            ? { executable: process.execPath, electronRunAsNode: false }
            : options.extensionRuntime,
      }),
      workspace,
      sessions,
      toolRuntime,
      logger: options.logger,
      testingApiEnabled: options.testingApiEnabled === true,
    };
  }

  async listen(options: {
    host: string;
    port: number;
    corsOrigins: readonly string[];
  }): Promise<HaloHttpConnections | HaloHttpError> {
    await this.context.workspace.restore();
    const workspace = this.context.workspace.getWorkspace();
    const listening = await listenHaloHttp({
      context: this.context,
      host: options.host,
      port: options.port,
      corsOrigins: options.corsOrigins,
    });
    if (listening instanceof Error) {
      await this.context.extensions.stop();
      return listening;
    }
    this.httpServer = listening.server;
    if (workspace !== undefined)
      await this.context.extensions.start(workspace.workspaceRoot);
    return listening.connections;
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

    await this.context.browsers.shutdown();
    const sessionsClosed = await this.context.sessions.shutdown();
    if (sessionsClosed instanceof Error) return sessionsClosed;
    await this.context.extensions.stop();
    const runtimeClosed = await this.context.toolRuntime.close();
    if (runtimeClosed instanceof Error) return runtimeClosed;

    if (this.httpServer !== undefined)
      await this.context.extensions.start(selected.workspaceRoot);

    return selected;
  }

  async close() {
    const httpClosed =
      this.httpServer === undefined
        ? undefined
        : await closeHaloHttp(this.httpServer);
    await this.context.browsers.shutdown();
    const sessionsClosed = await this.context.sessions.shutdown();
    await this.context.extensions.stop();
    const runtimeClosed = await this.context.toolRuntime.close();
    this.context.workspace.close();
    const filesystemClosed = await this.filesystem.close();

    if (httpClosed instanceof Error) return httpClosed;
    if (sessionsClosed instanceof Error) return sessionsClosed;
    if (runtimeClosed instanceof Error) return runtimeClosed;
    if (filesystemClosed instanceof Error) return filesystemClosed;
  }
}
