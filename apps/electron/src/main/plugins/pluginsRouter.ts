import { implement, ORPCError } from "@orpc/server";
import { createPluginToolsFacade } from "@halo/plugin-sdk/host";
import type { Logger } from "@repo/logger";
import { contract } from "../../shared/contract.js";
import { orpcErrors } from "../orpcErrors.js";
import type { WorkspaceService } from "../workspace/WorkspaceService.js";
import type { ToolRuntimeService } from "../agent/runtime/ToolRuntimeService.js";
import type { PluginService } from "./PluginService.js";
import type { PluginToolGrants } from "./PluginToolGrants.js";

export type PluginsRouterContext = {
  plugins: PluginService;
  pluginToolGrants: PluginToolGrants;
  toolRuntime: ToolRuntimeService;
  workspace: WorkspaceService;
  logger: Logger;
};

const os = implement(contract.plugins).$context<PluginsRouterContext>();

export const pluginsRouter = os.router({
  list: os.list.handler(async ({ context }) => {
    context.logger.info({ event: "listPlugins" });
    const listed = await context.plugins.list();
    if (listed instanceof Error) return orpcErrors.badRequest(listed);
    context.logger.info({
      event: "listPluginsResult",
      pluginIds: listed.plugins.map((plugin) => plugin.id),
      compiledViewIds: listed.compiledViews.map((view) => view.id),
      errors: listed.errors,
    });
    return listed;
  }),
  create: os.create.handler(async ({ input, context }) => {
    context.logger.info({ event: "plugin.create", id: input.id });
    const created = await context.plugins.create(input.id);
    if (created instanceof Error) return orpcErrors.badRequest(created);
    return created;
  }),
  build: os.build.handler(async ({ context }) => {
    context.logger.info({ event: "plugin.build" });
    const built = await context.plugins.build();
    if (built instanceof Error) return orpcErrors.badRequest(built);
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
    const manifest = await context.plugins.getManifest(input.pluginId);
    if (manifest instanceof Error) return orpcErrors.badRequest(manifest);
    const declaredPaths =
      manifest.halo.capabilities === undefined
        ? []
        : manifest.halo.capabilities;
    const tools = createPluginToolsFacade({
      authorize: (path) =>
        context.pluginToolGrants.authorize({
          pluginId: input.pluginId,
          declaredPaths,
          path,
        }),
      invoke: async (path, toolInput) => {
        const runtime = await context.toolRuntime.get();
        if (runtime instanceof Error) return runtime;
        return runtime.invokePath({ path, args: toolInput, signal });
      },
    });
    const result = await context.plugins.invoke({
      ...input,
      signal,
      lastEventId,
      tools,
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
