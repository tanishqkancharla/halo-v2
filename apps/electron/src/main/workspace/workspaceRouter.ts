import { dialog, type BrowserWindow } from "electron";
import { implement } from "@orpc/server";
import { AsyncEventQueue } from "@halo/plugin-sdk/shared";
import type { Logger } from "@repo/logger";
import { contract } from "../../shared/contract.js";
import type { WorkspaceTreeEvent } from "../../shared/rpc.js";
import { orpcErrors } from "../orpcErrors.js";
import type { WorkspaceService } from "./WorkspaceService.js";

export type WorkspaceRouterContext = {
  workspace: WorkspaceService;
  getWindow: () => BrowserWindow;
  logger: Logger;
};

const os = implement(contract.workspace).$context<WorkspaceRouterContext>();

export const workspaceRouter = os.router({
  get: os.get.handler(({ context }) => {
    context.logger.info({ event: "getWorkspace" });
    return context.workspace.getWorkspace();
  }),
  choose: os.choose.handler(async ({ context }) => {
    context.logger.info({ event: "chooseWorkspace" });
    const selection = await dialog.showOpenDialog(context.getWindow(), {
      title: "Choose a Halo workspace",
      buttonLabel: "Choose workspace",
      properties: ["openDirectory"],
    });
    if (selection.canceled) return undefined;
    const workspace = await context.workspace.select(selection.filePaths[0]!);
    if (workspace instanceof Error) return orpcErrors.badRequest(workspace);
    return workspace;
  }),
  listPaths: os.listPaths.handler(async ({ context }) => {
    context.logger.info({ event: "listWorkspacePaths" });
    const paths = await context.workspace.listPaths();
    if (paths instanceof Error) return orpcErrors.badRequest(paths);
    return paths;
  }),
  events: os.events.handler(({ context, signal }) => {
    context.logger.info({ event: "subscribeWorkspaceTree" });
    const queue = new AsyncEventQueue<WorkspaceTreeEvent[]>();
    context.workspace.setTreeListener((events) => {
      void queue.push(events);
    });
    return (async function* () {
      try {
        yield* queue.values(signal);
      } finally {
        context.workspace.setTreeListener(undefined);
      }
    })();
  }),
});
