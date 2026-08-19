import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { RpcTarget } from "@halo/plugin-sdk/server";
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

export class PluginNotFoundError extends errore.createTaggedError({
  name: "PluginNotFoundError",
  message: "Plugin '$pluginId' has no server",
}) {}

export class PluginService {
  private servers: Record<string, RpcTarget> = {};

  constructor(private readonly workspace: WorkspaceService) {}

  async list() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;

    this.servers = {};

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
          context: { pluginId: id, workspaceRoot: layout.root },
        });
        if (server instanceof Error) {
          errors.push({ id, message: server.message });
          continue;
        }
        this.servers[id] = wrapPluginRpc(server);
      }

      plugins.push(manifest);
      if (compiled !== undefined) compiledViews.push(compiled);
    }
    return { plugins, compiledViews, errors };
  }

  getPlugin(pluginId: string) {
    const server = this.servers[pluginId];
    if (server === undefined) return new PluginNotFoundError({ pluginId });
    return server;
  }
}

function wrapPluginRpc(target: RpcTarget): RpcTarget {
  class PluginRpc extends RpcTarget {}

  const seen = new Set<string>();
  let proto: object | null = Object.getPrototypeOf(target);
  while (proto !== null && proto !== Object.prototype) {
    // Rolldown copies capnweb into the main bundle, so the plugin's RpcTarget
    // prototype is a different object than this import.
    if (proto === RpcTarget.prototype) break;
    if (proto.constructor.name === "RpcTarget") break;
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === "constructor") continue;
      if (seen.has(name)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      if (descriptor === undefined) continue;
      if (typeof descriptor.value !== "function") continue;
      seen.add(name);
      const method = descriptor.value as (...args: unknown[]) => unknown;
      Object.defineProperty(PluginRpc.prototype, name, {
        enumerable: false,
        configurable: true,
        writable: true,
        async value(...args: unknown[]) {
          const result = await method.apply(target, args);
          if (result instanceof Error) throw result;
          return result;
        },
      });
    }
    proto = Object.getPrototypeOf(proto);
  }

  return new PluginRpc();
}
