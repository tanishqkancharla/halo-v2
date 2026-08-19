import { createRequire } from "node:module";
import { createJiti } from "jiti";
import type { PluginServerContext, RpcTarget } from "@halo/plugin-sdk/server";
import * as errore from "errore";

export class PluginServerLoadError extends errore.createTaggedError({
  name: "PluginServerLoadError",
  message: "Plugin '$id' server failed to load: $detail",
}) {}

type RpcTargetClass = typeof import("@halo/plugin-sdk/server").RpcTarget;

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
const pluginSdkServer = jiti.import("@halo/plugin-sdk/server") as Promise<
  typeof import("@halo/plugin-sdk/server")
>;

export async function loadPluginServer(args: {
  id: string;
  serverPath: string;
  context: PluginServerContext;
}): Promise<PluginServerLoadError | RpcTarget> {
  const { RpcTarget: PluginRpcTarget } = await pluginSdkServer;
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

  const exported = pluginServerExport(imported, PluginRpcTarget);
  if (exported === undefined) {
    return new PluginServerLoadError({
      id: args.id,
      detail: "server must export a default RpcTarget class or instance",
    });
  }
  return instantiatePluginServer(
    args.id,
    exported,
    args.context,
    PluginRpcTarget,
  );
}

function sdkEntry(subpath: "schema" | "server" | "view") {
  return requireFromThisFile.resolve(`@halo/plugin-sdk/${subpath}`);
}

function pluginServerExport(
  moduleExports: unknown,
  PluginRpcTarget: RpcTargetClass,
): unknown {
  if (isPluginServerExport(moduleExports, PluginRpcTarget))
    return moduleExports;
  if (typeof moduleExports !== "object" || moduleExports === null) {
    return undefined;
  }
  const record = moduleExports as Record<string, unknown>;
  if (isPluginServerExport(record.default, PluginRpcTarget)) {
    return record.default;
  }
  if (isPluginServerExport(record.Server, PluginRpcTarget)) {
    return record.Server;
  }
  return undefined;
}

function isPluginServerExport(value: unknown, PluginRpcTarget: RpcTargetClass) {
  return typeof value === "function" || value instanceof PluginRpcTarget;
}

function instantiatePluginServer(
  id: string,
  exported: unknown,
  context: PluginServerContext,
  PluginRpcTarget: RpcTargetClass,
): PluginServerLoadError | RpcTarget {
  if (exported instanceof PluginRpcTarget) return exported;

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
  if (constructed instanceof PluginRpcTarget) return constructed;
  return new PluginServerLoadError({
    id,
    detail: "server class must extend RpcTarget",
  });
}
