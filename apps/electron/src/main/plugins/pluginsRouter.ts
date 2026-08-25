import { implement, ORPCError } from "@orpc/server";
import type { Logger } from "@repo/logger";
import { contract } from "../../shared/contract.js";
import { orpcErrors } from "../orpcErrors.js";
import type { HaloTandem } from "../HaloTandem.js";
import type { WorkspaceService } from "../workspace/WorkspaceService.js";
import type { PluginService } from "./PluginService.js";

export type PluginsRouterContext = {
  plugins: PluginService;
  workspace: WorkspaceService;
  tandem: HaloTandem;
  logger: Logger;
};

const os = implement(contract.plugins).$context<PluginsRouterContext>();

export const pluginsRouter = os.router({
  create: os.create.handler(async ({ input, context }) => {
    context.logger.info({ event: "plugin.create", id: input.id });
    const created = await context.plugins.create(input.id);
    if (created instanceof Error) return orpcErrors.badRequest(created);
    await context.tandem.refreshPlugins();
    return created;
  }),
  build: os.build.handler(async ({ context }) => {
    context.logger.info({ event: "plugin.build" });
    const built = await context.plugins.build();
    if (built instanceof Error) return orpcErrors.badRequest(built);
    await context.tandem.refreshPlugins();
    return built;
  }),
  types: os.types.handler(async ({ context }) => {
    context.logger.info({ event: "plugin.types" });
    const checked = await context.plugins.types();
    if (checked instanceof Error) return orpcErrors.badRequest(checked);
    return checked;
  }),
  invoke: os.invoke.handler(async ({ input, context, signal, lastEventId }) => {
    context.logger.info({
      event: "plugin.invoke",
      pluginId: input.pluginId,
      path: input.path,
    });
    const result = await context.plugins.invoke({
      ...input,
      signal,
      lastEventId,
    });
    if (result instanceof Error) {
      return new ORPCError("PLUGIN_ERROR", {
        message: result.message,
        cause: result,
      });
    }
    return result;
  }),
});
