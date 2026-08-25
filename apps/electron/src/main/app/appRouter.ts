import { implement } from "@orpc/server";
import type { Logger } from "@repo/logger";
import { contract } from "../../shared/contract.js";
import { orpcErrors } from "../orpcErrors.js";
import type { HaloTandem } from "../HaloTandem.js";
import { getAppInfo, installAppUpdate } from "./AppUpdate.js";

export type AppRouterContext = {
  tandem: HaloTandem;
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
  installAppUpdate: os.installAppUpdate.handler(async ({ context }) => {
    const result = installAppUpdate();
    if (result instanceof Error) return orpcErrors.badRequest(result);
    await context.tandem.publishAppInfo(getAppInfo());
  }),
});
