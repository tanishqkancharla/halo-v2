import { implement } from "@orpc/server";
import type { Logger } from "@get-halo/logger";
import { contract } from "@get-halo/shared/contract";
import type { WorkspaceService } from "../workspace/WorkspaceService.js";

export type AppRouterContext = {
  workspace: WorkspaceService;
  logger: Logger;
};

const os = implement({
  getServerInfo: contract.getServerInfo,
}).$context<AppRouterContext>();

export const appRouter = os.router({
  getServerInfo: os.getServerInfo.handler(({ context }) => {
    context.logger.info({ event: "getServerInfo" });
    return { version: context.workspace.appVersion };
  }),
});
