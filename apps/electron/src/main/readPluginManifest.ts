import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { haloManifestSchema, parseVersioned } from "@halo/plugin-sdk/schema";
import * as errore from "errore";
import {
  PluginManifestError,
  type PluginManifest,
} from "../shared/pluginManifest.js";

const viewFallbacks = [
  "view.tsx",
  "view/index.tsx",
  "view.ts",
  "view/index.ts",
] as const;

const serverFallbacks = ["server.ts", "server/index.ts"] as const;

export async function readPluginManifest(args: {
  id: string;
  directory: string;
}): Promise<PluginManifestError | PluginManifest> {
  const raw = await readFile(
    join(args.directory, "package.json"),
    "utf8",
  ).catch(
    (e) =>
      new PluginManifestError({
        id: args.id,
        detail: "missing package.json",
        cause: e,
      }),
  );
  if (raw instanceof Error) return raw;

  const parsed = errore.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (e) =>
      new PluginManifestError({
        id: args.id,
        detail: "invalid JSON",
        cause: e,
      }),
  });
  if (parsed instanceof Error) return parsed;
  if (typeof parsed !== "object" || parsed === null) {
    return new PluginManifestError({
      id: args.id,
      detail: "package.json must be an object",
    });
  }

  if (
    !("name" in parsed) ||
    typeof parsed.name !== "string" ||
    parsed.name.length === 0
  ) {
    return new PluginManifestError({
      id: args.id,
      detail: "package.json name must be a non-empty string",
    });
  }

  const halo = parseVersioned({
    name: `plugin.${args.id}.halo`,
    schema: haloManifestSchema,
    value: "halo" in parsed ? parsed.halo : undefined,
  });
  if (halo instanceof Error) {
    return new PluginManifestError({
      id: args.id,
      detail: halo.message,
      cause: halo,
    });
  }

  const viewPath = resolvePluginEntry({
    id: args.id,
    directory: args.directory,
    kind: "view",
    explicit: halo.view,
    fallbacks: viewFallbacks,
  });
  if (viewPath instanceof Error) return viewPath;

  const serverPath = resolvePluginEntry({
    id: args.id,
    directory: args.directory,
    kind: "server",
    explicit: halo.server,
    fallbacks: serverFallbacks,
  });
  if (serverPath instanceof Error) return serverPath;

  return {
    id: args.id,
    directory: args.directory,
    packageName: parsed.name,
    halo,
    viewPath,
    serverPath,
  };
}

function resolvePluginEntry(args: {
  id: string;
  directory: string;
  kind: "view" | "server";
  explicit: string | undefined;
  fallbacks: readonly string[];
}) {
  if (args.explicit !== undefined) {
    const path = join(args.directory, args.explicit);
    if (!existsSync(path)) {
      return new PluginManifestError({
        id: args.id,
        detail: `missing ${args.kind} file ${args.explicit}`,
      });
    }
    return path;
  }

  for (const relativePath of args.fallbacks) {
    const path = join(args.directory, relativePath);
    if (existsSync(path)) return path;
  }
  return undefined;
}
