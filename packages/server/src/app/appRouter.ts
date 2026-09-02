import { implement } from "@orpc/server";
import type { Logger } from "@get-halo/logger";
import { contract } from "@get-halo/shared/contract";
import { orpcErrors } from "../orpcErrors.js";
import type { ServerHost } from "../ServerHost.js";

export type AppRouterContext = {
  host: ServerHost;
  logger: Logger;
};

const os = implement({
  getAppInfo: contract.getAppInfo,
  installAppUpdate: contract.installAppUpdate,
}).$context<AppRouterContext>();

export const appRouter = os.router({
  getAppInfo: os.getAppInfo.handler(({ context }) => {
    context.logger.info({ event: "getAppInfo" });
    return context.host.getAppInfo();
  }),
  installAppUpdate: os.installAppUpdate.handler(({ context }) => {
    const result = context.host.installAppUpdate();
    if (result instanceof Error) return orpcErrors.badRequest(result);
  }),
});
