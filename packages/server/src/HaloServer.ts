import {
  BrowserService,
  type AppBrowserTarget,
} from "./browser/BrowserService.js";
import type { Logger } from "@repo/logger";
import * as errore from "errore";
import { FilesystemService } from "./filesystem/FilesystemService.js";
import { closeHaloHttp, listenHaloHttp, serveHaloHttp } from "./http.js";
import { ExtensionHost } from "./extensions/ExtensionHost.js";
import { ExtensionTools } from "./extensions/ExtensionTools.js";
import type { ExtensionRuntime } from "./extensions/ExtensionProcess.js";
import type { HaloContext } from "./router.js";
import { SessionRegistry } from "./sessions/SessionRegistry.js";
import { WorkspaceService } from "./workspace/WorkspaceService.js";
import { StaticAgentAuthority } from "./agent/runtime/AgentAuthority.js";
import type { CredentialVault } from "./agent/runtime/CredentialVault.js";
import { ConnectionService } from "./agent/runtime/ConnectionService.js";
import { ToolRuntime } from "./agent/runtime/ToolRuntime.js";
import { workspaceBashPlugin } from "./agent/tools/bash/WorkspaceBashPlugin.js";
import { createWorkspaceFilesPlugin } from "./agent/tools/files/WorkspaceFilesPlugin.js";
import { parallelSearchPlugin } from "./agent/tools/web/ParallelSearchPlugin.js";

export type HaloServerOptions = {
  workspaceRoot: string;
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

type ListeningHttp = Exclude<Awaited<ReturnType<typeof listenHaloHttp>>, Error>;

export class HaloServer {
  private constructor(
    private readonly resources: {
      context: HaloContext;
      filesystem: FilesystemService;
      http: ListeningHttp;
    },
  ) {}

  static async start(
    options: HaloServerOptions & {
      host: string;
      port: number;
      corsOrigins: readonly string[];
    },
  ): Promise<HaloServer | Error> {
    await using cleanup = new errore.AsyncDisposableStack();
    const filesystem = new FilesystemService();
    cleanup.defer(async () => {
      const closed = await filesystem.close();
      if (closed instanceof Error)
        options.logger.warn({
          event: "filesystem-cleanup-failed",
          error: closed,
        });
    });

    const [workspace, http, ownerUserId] = await Promise.all([
      WorkspaceService.create({
        workspaceRoot: options.workspaceRoot,
        appDataDir: options.appDataDir,
        filesystem,
        appVersion: options.appVersion,
        cliEntry: options.cliEntry,
        cliNodeExecutable: options.cliNodeExecutable,
        cliElectronRunAsNode: options.cliElectronRunAsNode,
      }),
      listenHaloHttp({ host: options.host, port: options.port }),
      options.ownerUserId,
    ]);
    if (!(workspace instanceof Error)) cleanup.defer(() => workspace.close());
    if (!(http instanceof Error))
      cleanup.defer(async () => {
        const closed = await closeHaloHttp(http.server);
        if (closed instanceof Error)
          options.logger.warn({ event: "http-cleanup-failed", error: closed });
      });
    if (workspace instanceof Error) return workspace;
    if (http instanceof Error) return http;
    if (ownerUserId instanceof Error) return ownerUserId;

    const workspaceRoot = workspace.layout.root;
    const [initialized, toolRuntime] = await Promise.all([
      workspace.initialize(),
      ToolRuntime.create({
        filesystem,
        workspaceRoot,
        userId: ownerUserId,
        credentialVault: options.createCredentialVault({
          filesystem,
          workspaceRoot,
        }),
        oauthRedirectUri: `${http.origin}/oauth/callback`,
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
      }),
    ]);
    if (!(toolRuntime instanceof Error))
      cleanup.defer(async () => {
        const closed = await toolRuntime.close();
        if (closed instanceof Error)
          options.logger.warn({
            event: "tool-runtime-cleanup-failed",
            error: closed,
          });
      });
    if (initialized instanceof Error) return initialized;
    if (toolRuntime instanceof Error) return toolRuntime;

    const extensions = new ExtensionHost({
      workspaceRoot,
      toolsOrigin: http.origin,
      filesystem,
      logger: options.logger,
      runtime:
        options.extensionRuntime === undefined
          ? { executable: process.execPath, electronRunAsNode: false }
          : options.extensionRuntime,
    });
    cleanup.defer(() => extensions.stop());
    const context: HaloContext = {
      browsers: new BrowserService(options.appBrowserTarget),
      browserControlAllowed: false,
      extensionApprovalAllowed: false,
      extensionTools: new ExtensionTools({
        filesystem,
        workspaceRoot,
        toolRuntime,
      }),
      extensions,
      workspace,
      sessions: new SessionRegistry({
        filesystem,
        layout: workspace.layout,
        toolRuntime,
      }),
      connections: new ConnectionService(toolRuntime),
      toolRuntime,
      logger: options.logger,
      testingApiEnabled: options.testingApiEnabled === true,
    };
    serveHaloHttp({ ...http, context, corsOrigins: options.corsOrigins });
    await extensions.reload();
    cleanup.move();
    return new HaloServer({ context, filesystem, http });
  }

  get connections() {
    return this.resources.http.connections;
  }

  getWorkspace() {
    return this.resources.context.workspace.getWorkspace();
  }

  async close() {
    const { context, filesystem, http } = this.resources;
    const httpClosed = await closeHaloHttp(http.server);
    context.connections.close();
    await context.browsers.shutdown();
    const sessionsClosed = await context.sessions.shutdown();
    await context.extensions.stop();
    const runtimeClosed = await context.toolRuntime.close();
    context.workspace.close();
    const filesystemClosed = await filesystem.close();

    if (httpClosed instanceof Error) return httpClosed;
    if (sessionsClosed instanceof Error) return sessionsClosed;
    if (runtimeClosed instanceof Error) return runtimeClosed;
    if (filesystemClosed instanceof Error) return filesystemClosed;
  }
}
