import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { AnyRouter } from "@orpc/server";
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
  constructor(private readonly workspace: WorkspaceService) {}

  async list() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;

    const pluginsRoot = join(layout.root, ".halo", "plugins");
    if (!existsSync(pluginsRoot)) {
      return { plugins: [], compiledViews: [], errors: [], routers: {} };
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
    const routers: Record<string, AnyRouter> = {};
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
        routers[id] = server;
      }

      plugins.push(manifest);
      if (compiled !== undefined) compiledViews.push(compiled);
    }
    return { plugins, compiledViews, errors, routers };
  }
}
