import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { SupportedMessagePort } from "@orpc/client/message-port";
import { RPCHandler } from "@orpc/server/message-port";
import type { AnyRouter } from "@orpc/server";
import {
  ORPCError,
  os,
  type PluginServerContext,
} from "@halo/plugin-sdk/server";
import * as errore from "errore";
import type { PluginList } from "../../shared/plugin.js";
import type { WorkspaceService } from "../workspace-service.js";
import { compilePluginView } from "./compilePluginView.js";
import { loadPluginServer } from "./loadPluginServer.js";
import { readPluginManifest } from "./readPluginManifest.js";

export class PluginIoError extends errore.createTaggedError({
  name: "PluginIoError",
  message: "Failed to list plugins",
}) {}

export class PluginService {
  private readonly routers: Record<string, AnyRouter> = {};
  private handler: RPCHandler<PluginServerContext> | undefined;

  constructor(private readonly workspace: WorkspaceService) {}

  async list() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;

    for (const id of Object.keys(this.routers)) {
      delete this.routers[id];
    }

    const pluginsRoot = join(layout.root, ".halo", "plugins");
    if (!existsSync(pluginsRoot)) {
      return { plugins: [], compiledViews: [], errors: [] };
    }

    const entries = await readdir(pluginsRoot, { withFileTypes: true }).catch(
      (e) => new PluginIoError({ cause: e }),
    );
    if (entries instanceof Error) return entries;

    const ids = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .toSorted((left, right) => left.localeCompare(right));

    const plugins: PluginList["plugins"] = [];
    const compiledViews: PluginList["compiledViews"] = [];
    const errors: PluginList["errors"] = [];
    for (const id of ids) {
      const manifest = await readPluginManifest({
        id,
        directory: join(pluginsRoot, id),
      });
      if (manifest instanceof Error) {
        errors.push({ id, message: manifest.message });
        continue;
      }

      let compiled: PluginList["compiledViews"][number] | undefined;
      if (manifest.viewPath !== undefined) {
        const view = await compilePluginView({
          id,
          directory: manifest.directory,
          viewPath: manifest.viewPath,
        });
        if (view instanceof Error) {
          errors.push({ id, message: view.message });
          continue;
        }
        compiled = view;
      }

      if (manifest.serverPath !== undefined) {
        const server = await loadPluginServer({
          id,
          serverPath: manifest.serverPath,
        });
        if (server instanceof Error) {
          errors.push({ id, message: server.message });
          continue;
        }
        this.routers[id] = mountPluginRouter(id, server);
      }

      plugins.push(manifest);
      if (compiled !== undefined) compiledViews.push(compiled);
    }
    return { plugins, compiledViews, errors };
  }

  attachRpc(port: SupportedMessagePort) {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;

    if (this.handler === undefined) {
      this.handler = new RPCHandler(this.routers);
    }
    this.handler.upgrade(port, {
      context: { pluginId: "", workspaceRoot: layout.root },
    });
  }
}

function mountPluginRouter(id: string, router: AnyRouter) {
  return os
    .use(async ({ next, context }) => {
      const result = await next({
        context: { ...context, pluginId: id },
      });
      if (result.output instanceof Error) {
        throw new ORPCError("PLUGIN_ERROR", {
          message: result.output.message,
          cause: result.output,
        });
      }
      return result;
    })
    .router(router);
}
