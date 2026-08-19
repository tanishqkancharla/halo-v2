import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import { RpcTarget, type PluginServerContext } from "@halo/plugin-sdk/server";
import * as errore from "errore";

export class PluginServerLoadError extends errore.createTaggedError({
  name: "PluginServerLoadError",
  message: "Plugin '$id' server failed to load: $detail",
}) {}

const jiti = createJiti(import.meta.url, {
  alias: {
    "@halo/plugin-sdk/schema": sdkEntry("schema"),
    "@halo/plugin-sdk/server": sdkEntry("server"),
    "@halo/plugin-sdk/view": sdkEntry("view"),
  },
});

export async function loadPluginServer(args: {
  id: string;
  serverPath: string;
  context: PluginServerContext;
}): Promise<PluginServerLoadError | RpcTarget> {
  const imported = await jiti
    .import(args.serverPath)
    .then((value) => value as unknown)
    .catch(
      (e) =>
        new PluginServerLoadError({
          id: args.id,
          detail: String(e),
          cause: e,
        }),
    );
  if (imported instanceof PluginServerLoadError) return imported;

  const exported = pluginServerExport(imported);
  if (exported === undefined) {
    return new PluginServerLoadError({
      id: args.id,
      detail: "server must export a default RpcTarget class or instance",
    });
  }
  return instantiatePluginServer(args.id, exported, args.context);
}

function sdkEntry(subpath: "schema" | "server" | "view") {
  return fileURLToPath(import.meta.resolve(`@halo/plugin-sdk/${subpath}`));
}

function pluginServerExport(moduleExports: unknown): unknown {
  if (typeof moduleExports === "function") return moduleExports;
  if (typeof moduleExports !== "object" || moduleExports === null) {
    return undefined;
  }
  const record = moduleExports as Record<string, unknown>;
  if (record.default !== undefined) return record.default;
  return record.Server;
}

function instantiatePluginServer(
  id: string,
  exported: unknown,
  context: PluginServerContext,
): PluginServerLoadError | RpcTarget {
  if (exported instanceof RpcTarget) return exported;

  if (typeof exported !== "function") {
    return new PluginServerLoadError({
      id,
      detail: "server must export a default RpcTarget class or instance",
    });
  }

  const Server = exported as new (context: PluginServerContext) => unknown;
  const constructed = errore.try({
    try: () => new Server(context),
    catch: (e) =>
      new PluginServerLoadError({
        id,
        detail: String(e),
        cause: e,
      }),
  });
  if (constructed instanceof PluginServerLoadError) return constructed;
  if (constructed instanceof RpcTarget) return constructed;
  return new PluginServerLoadError({
    id,
    detail: "server class must extend RpcTarget",
  });
}
