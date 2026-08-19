import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import * as errore from "errore";
import type { PluginList } from "../../shared/plugin.js";
import type { WorkspaceService } from "../workspace-service.js";
import { compilePluginView } from "./compilePluginView.js";
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

      if (manifest.viewPath === undefined) {
        plugins.push(manifest);
        continue;
      }

      const compiled = await compilePluginView({
        id,
        directory: manifest.directory,
        viewPath: manifest.viewPath,
      });
      if (compiled instanceof Error) {
        errors.push({ id, message: compiled.message });
        continue;
      }

      plugins.push(manifest);
      compiledViews.push(compiled);
    }
    return { plugins, compiledViews, errors };
  }
}
