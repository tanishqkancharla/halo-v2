import { dialog, type BrowserWindow } from "electron";
import { ORPCError, implement } from "@orpc/server";
import type { Logger } from "@repo/logger";
import { contract } from "../shared/contract.js";
import {
  getAppInfo as readAppInfo,
  installAppUpdate as installDownloadedUpdate,
} from "./AppUpdate.js";
import type { AgentSessionRegistry } from "./AgentSessionRegistry.js";
import type { PiService } from "./pi-service.js";
import type { PluginService } from "./plugins/PluginService.js";
import type { WorkspaceService } from "./workspace-service.js";

export type HaloContext = {
  workspace: WorkspaceService;
  pi: PiService;
  plugins: PluginService;
  sessions: AgentSessionRegistry;
  getWindow: () => BrowserWindow;
  logger: Logger;
};

const os = implement(contract).$context<HaloContext>();

function fail(error: Error) {
  return new ORPCError("BAD_REQUEST", {
    message: error.message,
    cause: error,
  });
}

export const router = os.router({
  getAppInfo: os.getAppInfo.handler(({ context }) => {
    context.logger.info({ event: "getAppInfo" });
    return readAppInfo();
  }),
  installAppUpdate: os.installAppUpdate.handler(() => {
    const result = installDownloadedUpdate();
    if (result instanceof Error) return fail(result);
  }),
  getWorkspace: os.getWorkspace.handler(({ context }) => {
    context.logger.info({ event: "getWorkspace" });
    return context.workspace.getWorkspace();
  }),
  chooseWorkspace: os.chooseWorkspace.handler(async ({ context }) => {
    context.logger.info({ event: "chooseWorkspace" });
    const selection = await dialog.showOpenDialog(context.getWindow(), {
      title: "Choose a Halo workspace",
      buttonLabel: "Choose workspace",
      properties: ["openDirectory"],
    });
    if (selection.canceled) return undefined;
    const workspace = await context.workspace.select(selection.filePaths[0]!);
    if (workspace instanceof Error) return fail(workspace);
    return workspace;
  }),
  listSessions: os.listSessions.handler(async ({ context }) => {
    context.logger.info({ event: "listSessions" });
    const sessions = await context.pi.listSessions();
    if (sessions instanceof Error) return fail(sessions);
    return sessions;
  }),
  listWorkspacePaths: os.listWorkspacePaths.handler(async ({ context }) => {
    context.logger.info({ event: "listWorkspacePaths" });
    const paths = await context.workspace.listPaths();
    if (paths instanceof Error) return fail(paths);
    return paths;
  }),
  listPlugins: os.listPlugins.handler(async ({ context }) => {
    context.logger.info({ event: "listPlugins" });
    const listed = await context.plugins.list();
    if (listed instanceof Error) return fail(listed);
    context.logger.info({
      event: "listPluginsResult",
      pluginIds: listed.plugins.map((plugin) => plugin.id),
      compiledViewIds: listed.compiledViews.map((view) => view.id),
      errors: listed.errors,
    });
    return listed;
  }),
  subscribeWorkspaceTree: os.subscribeWorkspaceTree.handler(() => {
    return new ORPCError("NOT_IMPLEMENTED");
  }),
  newAgentSession: os.newAgentSession.handler(() => {
    return new ORPCError("NOT_IMPLEMENTED");
  }),
  openAgentSession: os.openAgentSession.handler(() => {
    return new ORPCError("NOT_IMPLEMENTED");
  }),
  agentSession: {
    events: os.agentSession.events.handler(() => {
      return new ORPCError("NOT_IMPLEMENTED");
    }),
    prompt: os.agentSession.prompt.handler(() => {
      return new ORPCError("NOT_IMPLEMENTED");
    }),
    close: os.agentSession.close.handler(() => {
      return new ORPCError("NOT_IMPLEMENTED");
    }),
  },
});
