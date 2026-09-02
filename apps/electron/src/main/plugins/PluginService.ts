import { join } from "node:path";
import { call, getRouter, Procedure, type AnyRouter } from "@orpc/server";
import type { PluginToolsFacade } from "@halo/plugin-sdk/server";
import * as errore from "errore";
import type { PluginInvocationInput } from "@get-halo/shared/contract";
import type { PluginList, PluginLoadError } from "@get-halo/shared/plugin";
import type { PluginManifest } from "@get-halo/shared/pluginManifest";
import type { FilesystemService } from "../filesystem/FilesystemService.js";
import {
  WorkspaceNotReadyError,
  type WorkspaceService,
} from "../workspace/WorkspaceService.js";
import { compilePluginView, readPluginViewDist } from "./compilePluginView.js";
import { loadPluginServer } from "./loadPluginServer.js";
import { parsePluginId } from "./pluginId.js";
import { readPluginManifest } from "./readPluginManifest.js";
import { writePluginScaffold } from "./scaffoldPlugin.js";
import { installPluginDependencies } from "./installPluginDependencies.js";
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

export class PluginNotMountedError extends errore.createTaggedError({
  name: "PluginNotMountedError",
  message: "Plugin '$id' is not mounted",
}) {}

export class PluginProcedureNotFoundError extends errore.createTaggedError({
  name: "PluginProcedureNotFoundError",
  message: "Plugin '$id' has no procedure at '$path'",
}) {}

export class PluginInvocationError extends errore.createTaggedError({
  name: "PluginInvocationError",
  message: "Plugin '$id' procedure '$path' failed",
}) {}

type PluginDirectory = {
  id: string;
  directory: string;
};

export class PluginService {
  private routers = new Map<string, AnyRouter>();

  private readonly filesystem: FilesystemService;
  private readonly workspace: WorkspaceService;
  private readonly dependencyInstaller: (
    directory: string,
  ) => Promise<Error | void>;

  constructor(options: {
    filesystem: FilesystemService;
    workspace: WorkspaceService;
    dependencyInstaller?: (directory: string) => Promise<Error | void>;
  }) {
    this.filesystem = options.filesystem;
    this.workspace = options.workspace;
    this.dependencyInstaller =
      options.dependencyInstaller === undefined
        ? installPluginDependencies
        : options.dependencyInstaller;
  }

  async create(input: { id: string; storage?: boolean }) {
    const parsed = parsePluginId(input.id);
    if (parsed instanceof Error) return parsed;

    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;

    const directory = join(layout.root, ".halo", "plugins", parsed);
    if (this.filesystem.exists(directory)) {
      return new PluginExistsError({ id: parsed });
    }

    const written = await writePluginScaffold({
      filesystem: this.filesystem,
      directory,
      id: parsed,
      appVersion: this.workspace.appVersion,
      storage: input.storage === true,
      installDependencies: this.dependencyInstaller,
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
      const manifest = await readPluginManifest({
        filesystem: this.filesystem,
        ...plugin,
      });
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
        filesystem: this.filesystem,
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
      const prepared = await writePluginTsconfig({
        filesystem: this.filesystem,
        directory: plugin.directory,
      });
      if (prepared instanceof Error) return prepared;
      written.push(plugin.id);
      const checked = await typecheckPlugin({
        filesystem: this.filesystem,
        directory: plugin.directory,
      });
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
    const routers = new Map<string, AnyRouter>();
    for (const plugin of listed) {
      const manifest = await readPluginManifest({
        filesystem: this.filesystem,
        ...plugin,
      });
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
          filesystem: this.filesystem,
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
        routers.set(plugin.id, server);
      }

      plugins.push(manifest);
      if (compiled !== undefined) compiledViews.push(compiled);
    }
    this.routers = routers;
    return { plugins, compiledViews, errors };
  }

  async listManifests() {
    const listed = await this.listPluginDirectories();
    if (listed instanceof Error) return listed;
    const manifests: PluginManifest[] = [];
    for (const plugin of listed) {
      const manifest = await readPluginManifest({
        filesystem: this.filesystem,
        ...plugin,
      });
      if (manifest instanceof Error) continue;
      manifests.push(manifest);
    }
    return manifests;
  }

  async getManifest(id: string) {
    const pluginId = parsePluginId(id);
    if (pluginId instanceof Error) return pluginId;
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;
    return await readPluginManifest({
      filesystem: this.filesystem,
      id: pluginId,
      directory: join(layout.root, ".halo", "plugins", pluginId),
    });
  }

  async invoke(args: {
    pluginId: string;
    path: string[];
    input: PluginInvocationInput["input"];
    signal?: AbortSignal;
    lastEventId?: string;
    tools: PluginToolsFacade;
  }) {
    const router = this.routers.get(args.pluginId);
    if (router === undefined)
      return new PluginNotMountedError({ id: args.pluginId });

    const procedure = getRouter(router, args.path);
    if (!(procedure instanceof Procedure)) {
      return new PluginProcedureNotFoundError({
        id: args.pluginId,
        path: args.path.join("."),
      });
    }

    const workspace = this.workspace.getWorkspace();
    if (workspace === undefined) return new WorkspaceNotReadyError();

    const result = await call(procedure, args.input, {
      context: {
        pluginId: args.pluginId,
        workspaceRoot: workspace.workspaceRoot,
        tools: args.tools,
      },
      signal: args.signal,
      lastEventId: args.lastEventId,
    }).catch(
      (e) =>
        new PluginInvocationError({
          id: args.pluginId,
          path: args.path.join("."),
          cause: e,
        }),
    );
    if (result instanceof Error) return result;
    return result;
  }

  private async listPluginDirectories() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;

    const pluginsRoot = join(layout.root, ".halo", "plugins");
    if (!this.filesystem.exists(pluginsRoot)) return [];

    const entries = await this.filesystem.listDirectory(pluginsRoot);
    if (entries instanceof Error) return new PluginIoError({ cause: entries });

    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry): PluginDirectory => ({
        id: entry.name,
        directory: join(pluginsRoot, entry.name),
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id));
  }

  private async assertPin(plugin: PluginDirectory) {
    const pin = await readPluginSdkPinFile({
      filesystem: this.filesystem,
      ...plugin,
    });
    if (pin instanceof Error) return pin;
    return assertPluginSdkPin({
      id: plugin.id,
      pin,
      appVersion: this.workspace.appVersion,
    });
  }
}
