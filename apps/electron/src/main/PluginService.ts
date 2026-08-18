import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import * as errore from "errore";
import type { PluginList } from "../shared/plugin.js";
import { readPluginManifest } from "./readPluginManifest.js";
import type { WorkspaceService } from "./workspace-service.js";

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
      return { plugins: [], errors: [] };
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
      plugins.push(manifest);
    }
    return { plugins, errors };
  }
}
