import { createRequire } from "node:module";
import { createJiti } from "jiti";
import { Lazy, Procedure, type AnyRouter } from "@orpc/server";
import * as errore from "errore";
import { isCallable } from "@get-halo/shared/isCallable";

export class PluginServerLoadError extends errore.createTaggedError({
  name: "PluginServerLoadError",
  message: "Plugin '$id' server failed to load: $detail",
}) {}

type PluginModule = AnyRouter & {
  default?: AnyRouter;
  router?: AnyRouter;
  Server?: AnyRouter;
};

function pluginServerJiti() {
  const requireFromThisFile = createRequire(import.meta.url);
  return createJiti(import.meta.url, {
    moduleCache: false,
    alias: {
      "@get-halo/plugin-sdk/schema": sdkEntry(requireFromThisFile, "schema"),
      "@get-halo/plugin-sdk/server": sdkEntry(requireFromThisFile, "server"),
      "@get-halo/plugin-sdk/storage": sdkEntry(requireFromThisFile, "storage"),
      "@get-halo/plugin-sdk/view": sdkEntry(requireFromThisFile, "view"),
      "@tanishqkancharla/tandem-core": requireFromThisFile.resolve(
        "@tanishqkancharla/tandem-core",
      ),
      "@tanishqkancharla/tandem-server": requireFromThisFile.resolve(
        "@tanishqkancharla/tandem-server",
      ),
    },
  });
}

export async function loadPluginServer(args: {
  id: string;
  serverPath: string;
}): Promise<PluginServerLoadError | AnyRouter> {
  const imported = await pluginServerJiti()
    .import(args.serverPath)
    .catch(
      (e) =>
        new PluginServerLoadError({
          id: args.id,
          detail: String(e),
          cause: e,
        }),
    );
  if (imported instanceof PluginServerLoadError) return imported;
  if (imported instanceof Procedure) return imported;
  if (isCallable({ value: imported })) {
    return new PluginServerLoadError({
      id: args.id,
      detail: "server must export an oRPC router",
    });
  }
  if ({}.toString.call(imported) !== "[object Object]") {
    return new PluginServerLoadError({
      id: args.id,
      detail: "server must export an oRPC router",
    });
  }
  // SAFETY: jiti.import is untyped; we read default, router, and Server as oRPC routers.
  const exported = routerFromExport(imported as PluginModule);
  if (exported === undefined) {
    return new PluginServerLoadError({
      id: args.id,
      detail: "server must export an oRPC router",
    });
  }
  return exported;
}

function routerFromExport(exported: PluginModule) {
  if (exported.router !== undefined && isPluginRouter(exported.router)) {
    return exported.router;
  }
  if (exported.Server !== undefined && isPluginRouter(exported.Server)) {
    return exported.Server;
  }
  if (exported.default !== undefined && isPluginRouter(exported.default)) {
    return exported.default;
  }
  if (isPluginRouter(exported)) return exported;
  return undefined;
}

function isPluginRouter(value: AnyRouter | Lazy<AnyRouter>) {
  if (value instanceof Lazy) return false;
  if (value instanceof Procedure) return true;
  if (isCallable({ value })) return false;
  if ({}.toString.call(value) !== "[object Object]") return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  for (const key of keys) {
    const nested = value[key];
    if (nested === undefined) return false;
    if (!isPluginRouter(nested)) return false;
  }
  return true;
}

function sdkEntry(
  requireFromThisFile: NodeRequire,
  subpath: "schema" | "server" | "storage" | "view",
) {
  return requireFromThisFile.resolve(`@get-halo/plugin-sdk/${subpath}`);
}
