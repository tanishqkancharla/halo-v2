import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { os as orpc, ORPCError, type AnyRouter } from "@orpc/server";
import * as errore from "errore";
import type { PluginList, PluginLoadError } from "../../shared/plugin.js";
import type { PluginManifest } from "../../shared/pluginManifest.js";
import { orpcErrors } from "../orpcErrors.js";
import {
  WorkspaceNotReadyError,
  type WorkspaceService,
} from "../workspace/WorkspaceService.js";
import { compilePluginView, readPluginViewDist } from "./compilePluginView.js";
import { loadPluginServer } from "./loadPluginServer.js";
import { parsePluginId } from "./pluginId.js";
import { readPluginManifest } from "./readPluginManifest.js";
import { writePluginScaffold } from "./scaffoldPlugin.js";
import { installPluginSdkContract } from "./installPluginSdk.js";
import { assertPluginSdkPin, readPluginSdkPinFile } from "./pluginSdkPin.js";
import { typecheckPlugin, writePluginTsconfig } from "./typecheckPlugin.js";

export class PluginIoError extends errore.createTaggedError({
  name: "PluginIoError",
  message: "Failed to list plugins",
}) {}

export class PluginExistsError extends errore.createTaggedError({
  name: "PluginExistsError",
  message: "Plugin '$id' already exists",
}) {}

type PluginDirectory = {
  id: string;
  directory: string;
};

export class PluginService {
  readonly router: Record<string, AnyRouter> = {};
  readonly lazyRouter = orpc.lazy(async () => ({ default: this.router }));

  constructor(private readonly workspace: WorkspaceService) {}

  async create(id: string) {
    const parsed = parsePluginId(id);
    if (parsed instanceof Error) return parsed;

    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;

    const directory = join(layout.root, ".halo", "plugins", parsed);
    if (existsSync(directory)) return new PluginExistsError({ id: parsed });

    const written = await writePluginScaffold({
      directory,
      id: parsed,
      appVersion: this.workspace.appVersion,
    });
    if (written instanceof Error) return written;
    return { id: parsed, directory };
  }

  async build() {
    const listed = await this.listPluginDirectories();
    if (listed instanceof Error) return listed;

    const built: string[] = [];
    const errors: PluginLoadError[] = [];
    for (const plugin of listed) {
      const manifest = await readPluginManifest(plugin);
      if (manifest instanceof Error) {
        errors.push({ id: plugin.id, message: manifest.message });
        continue;
      }
      if (manifest.viewPath === undefined) continue;

      const pin = await this.assertPin(plugin);
      if (pin instanceof Error) {
        errors.push({ id: plugin.id, message: pin.message });
        continue;
      }

      const compiled = await compilePluginView({
        id: plugin.id,
        directory: manifest.directory,
        viewPath: manifest.viewPath,
        outfile: join(manifest.directory, "dist", "view.js"),
      });
      if (compiled instanceof Error) {
        errors.push({ id: plugin.id, message: compiled.message });
        continue;
      }
      built.push(plugin.id);
    }

    const remounted = await this.list();
    if (remounted instanceof Error) return remounted;
    return { built, errors };
  }

  async types() {
    const listed = await this.listManifests();
    if (listed instanceof Error) return listed;

    const written: string[] = [];
    const diagnostics: Array<{
      id: string;
      file: string;
      line: number;
      message: string;
    }> = [];
    for (const plugin of listed) {
      const pin = await this.assertPin({
        id: plugin.id,
        directory: plugin.directory,
      });
      if (pin instanceof Error) {
        diagnostics.push({
          id: plugin.id,
          file: "package.json",
          line: 1,
          message: pin.message,
        });
        continue;
      }
      const installed = await installPluginSdkContract({
        directory: plugin.directory,
        appVersion: this.workspace.appVersion,
      });
      if (installed instanceof Error) return installed;
      const prepared = await writePluginTsconfig(plugin.directory);
      if (prepared instanceof Error) return prepared;
      written.push(plugin.id);
      const checked = await typecheckPlugin(plugin.directory);
      if (checked instanceof Error) return checked;
      for (const diagnostic of checked) {
        diagnostics.push({ id: plugin.id, ...diagnostic });
      }
    }
    return { written, diagnostics };
  }

  async list() {
    const listed = await this.listPluginDirectories();
    if (listed instanceof Error) return listed;

    const plugins: PluginList["plugins"] = [];
    const compiledViews: PluginList["compiledViews"] = [];
    const errors: PluginList["errors"] = [];
    this.clearMounted();
    for (const plugin of listed) {
      const manifest = await readPluginManifest(plugin);
      if (manifest instanceof Error) {
        errors.push({ id: plugin.id, message: manifest.message });
        continue;
      }

      const pin = await this.assertPin(plugin);
      if (pin instanceof Error) {
        errors.push({ id: plugin.id, message: pin.message });
        continue;
      }

      let compiled: PluginList["compiledViews"][number] | undefined;
      if (manifest.viewPath !== undefined) {
        const view = await readPluginViewDist({
          id: plugin.id,
          directory: manifest.directory,
        });
        if (view instanceof Error) {
          errors.push({ id: plugin.id, message: view.message });
          continue;
        }
        compiled = view;
      }

      if (manifest.serverPath !== undefined) {
        const server = await loadPluginServer({
          id: plugin.id,
          serverPath: manifest.serverPath,
        });
        if (server instanceof Error) {
          errors.push({ id: plugin.id, message: server.message });
          continue;
        }
        this.router[plugin.id] = mountPluginRouter({
          pluginId: plugin.id,
          router: server,
        });
      }

      plugins.push(manifest);
      if (compiled !== undefined) compiledViews.push(compiled);
    }
    return { plugins, compiledViews, errors };
  }

  async listManifests() {
    const listed = await this.listPluginDirectories();
    if (listed instanceof Error) return listed;
    const manifests: PluginManifest[] = [];
    for (const plugin of listed) {
      const manifest = await readPluginManifest(plugin);
      if (manifest instanceof Error) continue;
      manifests.push(manifest);
    }
    return manifests;
  }

  private async listPluginDirectories() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;

    const pluginsRoot = join(layout.root, ".halo", "plugins");
    if (!existsSync(pluginsRoot)) return [];

    const entries = await readdir(pluginsRoot, { withFileTypes: true }).catch(
      (e) => new PluginIoError({ cause: e }),
    );
    if (entries instanceof Error) return entries;

    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map(
        (entry): PluginDirectory => ({
          id: entry.name,
          directory: join(pluginsRoot, entry.name),
        }),
      )
      .toSorted((left, right) => left.id.localeCompare(right.id));
  }

  private async assertPin(plugin: PluginDirectory) {
    const pin = await readPluginSdkPinFile(plugin);
    if (pin instanceof Error) return pin;
    return assertPluginSdkPin({
      id: plugin.id,
      pin,
      appVersion: this.workspace.appVersion,
    });
  }

  private clearMounted() {
    for (const id of Object.keys(this.router)) {
      delete this.router[id];
    }
  }
}

function mountPluginRouter(args: { pluginId: string; router: AnyRouter }) {
  return orpc
    .$context<{ workspace: WorkspaceService }>()
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
