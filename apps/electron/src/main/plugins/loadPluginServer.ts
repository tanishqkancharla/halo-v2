import { createRequire } from "node:module";
import { createJiti } from "jiti";
import type { PluginServerContext, RpcTarget } from "@halo/plugin-sdk/server";
import * as errore from "errore";

export class PluginServerLoadError extends errore.createTaggedError({
  name: "PluginServerLoadError",
  message: "Plugin '$id' server failed to load: $detail",
}) {}

// Rolldown's CJS build turns `import.meta.resolve` into `{}.resolve` and
// copies capnweb into the main bundle. jiti loads @halo/plugin-sdk/server from
// disk, so instanceof must use that same module.
const requireFromThisFile = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
  alias: {
    "@halo/plugin-sdk/schema": sdkEntry("schema"),
    "@halo/plugin-sdk/server": sdkEntry("server"),
    "@halo/plugin-sdk/view": sdkEntry("view"),
  },
});
const pluginSdkServer = jiti.import("@halo/plugin-sdk/server") as Promise<{
  RpcTarget: abstract new (...args: never[]) => RpcTarget;
}>;

export async function loadPluginServer(args: {
  id: string;
  serverPath: string;
  context: PluginServerContext;
}): Promise<PluginServerLoadError | RpcTarget> {
  const { RpcTarget: JitiRpcTarget } = await pluginSdkServer;

  function isServerExport(value: unknown) {
    return typeof value === "function" || value instanceof JitiRpcTarget;
  }

  function serverExport(moduleExports: unknown): unknown {
    if (isServerExport(moduleExports)) return moduleExports;
    if (typeof moduleExports !== "object" || moduleExports === null) {
      return undefined;
    }
    const record = moduleExports as Record<string, unknown>;
    if (isServerExport(record.default)) return record.default;
    if (isServerExport(record.Server)) return record.Server;
    return undefined;
  }

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

  const exported = serverExport(imported);
  if (exported === undefined) {
    return new PluginServerLoadError({
      id: args.id,
      detail: "server must export a default RpcTarget class or instance",
    });
  }
  if (exported instanceof JitiRpcTarget) return exported;
  if (typeof exported !== "function") {
    return new PluginServerLoadError({
      id: args.id,
      detail: "server must export a default RpcTarget class or instance",
    });
  }

  const Server = exported as new (context: PluginServerContext) => unknown;
  const constructed = errore.try({
    try: () => new Server(args.context),
    catch: (e) =>
      new PluginServerLoadError({
        id: args.id,
        detail: String(e),
        cause: e,
      }),
  });
  if (constructed instanceof PluginServerLoadError) return constructed;
  if (constructed instanceof JitiRpcTarget) return constructed;
  return new PluginServerLoadError({
    id: args.id,
    detail: "server class must extend RpcTarget",
  });
}

function sdkEntry(subpath: "schema" | "server" | "view") {
  return requireFromThisFile.resolve(`@halo/plugin-sdk/${subpath}`);
}
