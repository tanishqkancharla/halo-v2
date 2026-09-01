import { dialog, type BrowserWindow } from "electron";
import { implement } from "@orpc/server";
import type { Logger } from "@repo/logger";
import { contract } from "@repo/shared/contract";
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
  readFile: os.readFile.handler(async ({ context, input }) => {
    context.logger.info({ event: "readWorkspaceFile", path: input.path });
    const contents = await context.workspace.readFile(input.path);
    if (contents instanceof Error) return orpcErrors.badRequest(contents);
    return contents;
  }),
  writeFile: os.writeFile.handler(async ({ context, input }) => {
    context.logger.info({ event: "writeWorkspaceFile", path: input.path });
    const written = await context.workspace.writeFile(
      input.path,
      input.content,
    );
    if (written instanceof Error) return orpcErrors.badRequest(written);
    return written;
  }),
  events: os.events.handler(({ context, signal }) => {
    context.logger.info({ event: "subscribeWorkspaceTree" });
    return context.workspace.treeEvents.consume(signal);
  }),
});
