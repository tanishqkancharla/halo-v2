import { implement } from "@orpc/server";
import type { Logger } from "@repo/logger";
import { contract } from "@repo/shared/contract";
import { orpcErrors } from "../orpcErrors.js";
import { getAppInfo, installAppUpdate } from "./AppUpdate.js";

export type AppRouterContext = {
  logger: Logger;
};

const os = implement({
  getAppInfo: contract.getAppInfo,
  installAppUpdate: contract.installAppUpdate,
}).$context<AppRouterContext>();

export const appRouter = os.router({
  getAppInfo: os.getAppInfo.handler(({ context }) => {
    context.logger.info({ event: "getAppInfo" });
    return getAppInfo();
  }),
  installAppUpdate: os.installAppUpdate.handler(() => {
    const result = installAppUpdate();
    if (result instanceof Error) return orpcErrors.badRequest(result);
  }),
});
