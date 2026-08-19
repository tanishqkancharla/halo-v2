import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import type { AnyRouter } from "@orpc/server";
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
}): Promise<PluginServerLoadError | AnyRouter> {
  const imported = await jiti
    .import(args.serverPath)
    .then((value) => value as object)
    .catch(
      (e) =>
        new PluginServerLoadError({
          id: args.id,
          detail: String(e),
          cause: e,
        }),
    );
  if (imported instanceof PluginServerLoadError) return imported;

  const router = exportedRouter(imported);
  if (router === undefined) {
    return new PluginServerLoadError({
      id: args.id,
      detail: "server must export default or router",
    });
  }
  return router;
}

function sdkEntry(subpath: "schema" | "server" | "view") {
  return fileURLToPath(import.meta.resolve(`@halo/plugin-sdk/${subpath}`));
}

function exportedRouter(moduleExports: unknown): AnyRouter | undefined {
  if (typeof moduleExports !== "object" || moduleExports === null) {
    return undefined;
  }
  const record = moduleExports as Record<string, unknown>;
  const fromDefault = asRouter(record.default);
  if (fromDefault !== undefined) return fromDefault;
  return asRouter(record.router);
}

function asRouter(value: unknown): AnyRouter | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return value as AnyRouter;
}
