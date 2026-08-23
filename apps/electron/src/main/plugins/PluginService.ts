import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { os as orpc, ORPCError, type AnyRouter } from "@orpc/server";
import * as errore from "errore";
import type { PluginList } from "../../shared/plugin.js";
import { orpcErrors } from "../orpcErrors.js";
import type { HaloContext } from "../router.js";
import {
  WorkspaceNotReadyError,
  type WorkspaceService,
} from "../workspace-service.js";
import { compilePluginView } from "./compilePluginView.js";
import { loadPluginServer } from "./loadPluginServer.js";
import { readPluginManifest } from "./readPluginManifest.js";

export class PluginIoError extends errore.createTaggedError({
  name: "PluginIoError",
  message: "Failed to list plugins",
}) {}

export class PluginService {
  readonly router: Record<string, AnyRouter> = {};
  readonly lazyRouter = orpc.lazy(async () => ({ default: this.router }));

  constructor(private readonly workspace: WorkspaceService) {}

  async list() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;

    const pluginsRoot = join(layout.root, ".halo", "plugins");
    if (!existsSync(pluginsRoot)) {
      this.clearMounted();
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
    this.clearMounted();
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
          workspaceRoot: layout.root,
        });
        if (server instanceof Error) {
          errors.push({ id, message: server.message });
          continue;
        }
        this.router[id] = mountPluginRouter({ pluginId: id, router: server });
      }

      plugins.push(manifest);
      if (compiled !== undefined) compiledViews.push(compiled);
    }
    return { plugins, compiledViews, errors };
  }

  private clearMounted() {
    for (const id of Object.keys(this.router)) {
      delete this.router[id];
    }
  }
}

function mountPluginRouter(args: { pluginId: string; router: AnyRouter }) {
  return orpc
    .$context<HaloContext>()
    .use(async ({ context, next }) => {
      const workspace = context.workspace.getWorkspace();
      if (workspace === undefined) {
        throw orpcErrors.badRequest(new WorkspaceNotReadyError());
      }
      const result = await next({
        context: {
          pluginId: args.pluginId,
          workspaceRoot: workspace.workspaceRoot,
        },
      });
      if (result.output instanceof ORPCError) return result;
      if (result.output instanceof Error) {
        throw new ORPCError("PLUGIN_ERROR", {
          message: result.output.message,
          cause: result.output,
        });
      }
      return result;
    })
    .router(args.router);
}
