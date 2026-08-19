import { createRequire } from "node:module";
import { createJiti } from "jiti";
import type { PluginServerContext, RpcTarget } from "@halo/plugin-sdk/server";
import * as errore from "errore";
import { isCallable } from "../../shared/isCallable.js";

export class PluginServerLoadError extends errore.createTaggedError({
  name: "PluginServerLoadError",
  message: "Plugin '$id' server failed to load: $detail",
}) {}

type PluginServerClass = new (context: PluginServerContext) => RpcTarget;

type PluginSdkServerModule = {
  RpcTarget: abstract new (...args: never[]) => RpcTarget;
};

type PluginModuleExports = {
  default?: PluginServerClass | RpcTarget;
  Server?: PluginServerClass | RpcTarget;
};

type PluginServerExport = PluginServerClass | RpcTarget | PluginModuleExports;

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
const pluginSdkServer = jiti.import("@halo/plugin-sdk/server");

export async function loadPluginServer(args: {
  id: string;
  serverPath: string;
  context: PluginServerContext;
}): Promise<PluginServerLoadError | RpcTarget> {
  const sdk = await pluginSdkServer;
  // SAFETY: jiti loads this alias from disk; the SDK module exports RpcTarget.
  const { RpcTarget: JitiRpcTarget } = sdk as PluginSdkServerModule;

  const imported = await jiti.import(args.serverPath).catch(
    (e) =>
      new PluginServerLoadError({
        id: args.id,
        detail: String(e),
        cause: e,
      }),
  );
  if (imported instanceof PluginServerLoadError) return imported;

  // SAFETY: jiti.import returns a module namespace, a class, or an RpcTarget instance.
  const exported = pluginServerFromExport({
    RpcTarget: JitiRpcTarget,
    exported: imported as PluginServerExport,
  });
  if (exported === undefined) {
    return new PluginServerLoadError({
      id: args.id,
      detail: "server must export a default RpcTarget class or instance",
    });
  }
  if (exported instanceof JitiRpcTarget) return exported;
  if (!isCallable({ value: exported })) {
    return new PluginServerLoadError({
      id: args.id,
      detail: "server must export a default RpcTarget class or instance",
    });
  }

  // SAFETY: function exports that are not RpcTarget instances are the server class.
  const Server = exported as PluginServerClass;
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

function pluginServerFromExport(args: {
  RpcTarget: abstract new (...args: never[]) => RpcTarget;
  exported: PluginServerExport;
}): PluginServerClass | RpcTarget | undefined {
  const JitiRpcTarget = args.RpcTarget;
  const fromExport = pluginServerFromCandidate({
    RpcTarget: JitiRpcTarget,
    candidate: args.exported,
  });
  if (fromExport !== undefined) return fromExport;
  // SAFETY: remaining jiti exports are the module namespace object.
  const record = args.exported as PluginModuleExports;
  const fromDefault = pluginServerFromCandidate({
    RpcTarget: JitiRpcTarget,
    candidate: record.default,
  });
  if (fromDefault !== undefined) return fromDefault;
  return pluginServerFromCandidate({
    RpcTarget: JitiRpcTarget,
    candidate: record.Server,
  });
}

function pluginServerFromCandidate(args: {
  RpcTarget: abstract new (...args: never[]) => RpcTarget;
  candidate: PluginServerExport | undefined;
}): PluginServerClass | RpcTarget | undefined {
  const candidate = args.candidate;
  if (candidate === undefined) return undefined;
  if (candidate instanceof args.RpcTarget) return candidate;
  if (isCallable({ value: candidate })) {
    // SAFETY: a function export from a plugin server module is the RpcTarget subclass.
    return candidate as PluginServerClass;
  }
  return undefined;
}

function sdkEntry(subpath: "schema" | "server" | "view") {
  return requireFromThisFile.resolve(`@halo/plugin-sdk/${subpath}`);
}
