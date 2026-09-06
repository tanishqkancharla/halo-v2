import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  parseVersioned,
  pluginPackageJsonSchema,
  type PluginContributions,
} from "@halo/plugin-sdk/schema";
import * as errore from "errore";
import {
  PluginManifestError,
  type PluginManifest,
} from "@get-halo/shared/pluginManifest";
import type { FilesystemService } from "../filesystem/FilesystemService.js";

const viewFallbacks = [
  "view.tsx",
  "view/index.tsx",
  "view.ts",
  "view/index.ts",
] as const;

const serverFallbacks = ["server.ts", "server/index.ts"] as const;

export async function readPluginManifest(args: {
  filesystem: FilesystemService;
  id: string;
  directory: string;
}): Promise<PluginManifestError | PluginManifest> {
  const raw = await args.filesystem.readFile(
    join(args.directory, "package.json"),
    "utf8",
  );
  if (raw instanceof Error) {
    return new PluginManifestError({
      id: args.id,
      detail: "missing package.json",
      cause: raw,
    });
  }

  const parsed = errore.try({
    try: () => {
      // SAFETY: JSON.parse is untyped; pluginPackageJsonSchema is the file contract.
      return JSON.parse(raw) as unknown;
    },
    catch: (e) =>
      new PluginManifestError({
        id: args.id,
        detail: "invalid JSON",
        cause: e,
      }),
  });
  if (parsed instanceof PluginManifestError) return parsed;

  const packageJson = parseVersioned({
    name: `plugin.${args.id}.package.json`,
    schema: pluginPackageJsonSchema,
    value: parsed,
  });
  if (packageJson instanceof Error) {
    return new PluginManifestError({
      id: args.id,
      detail: packageJson.message,
      cause: packageJson,
    });
  }

  if (packageJson.halo.contributes !== undefined) {
    const validated = await validateContributions({
      ...args,
      contributes: packageJson.halo.contributes,
    });
    if (validated instanceof Error) return validated;
  }

  const viewPath = resolvePluginEntry({
    filesystem: args.filesystem,
    id: args.id,
    directory: args.directory,
    kind: "view",
    explicit: packageJson.halo.view,
    fallbacks: viewFallbacks,
  });
  if (viewPath instanceof Error) return viewPath;

  const serverPath = resolvePluginEntry({
    filesystem: args.filesystem,
    id: args.id,
    directory: args.directory,
    kind: "server",
    explicit: packageJson.halo.server,
    fallbacks: serverFallbacks,
  });
  if (serverPath instanceof Error) return serverPath;

  return {
    id: args.id,
    directory: args.directory,
    packageName: packageJson.name,
    halo: {
      ...packageJson.halo,
      capabilities:
        packageJson.halo.capabilities === undefined
          ? []
          : packageJson.halo.capabilities,
    },
    viewPath,
    serverPath,
  };
}

async function validateContributions(args: {
  filesystem: FilesystemService;
  id: string;
  directory: string;
  contributes: PluginContributions;
}) {
  const invalid = (detail: string, cause?: Error) =>
    new PluginManifestError({ id: args.id, detail, cause });
  for (const kind of ["sidebar", "panes"] as const) {
    const ids = new Set<string>();
    for (const entity of args.contributes[kind]) {
      if (ids.has(entity.id))
        return invalid(`duplicate ${kind} id '${entity.id}'`);
      ids.add(entity.id);
    }
  }
  const panes = new Set(args.contributes.panes.map((pane) => pane.id));
  for (const entity of args.contributes.sidebar) {
    if (!panes.has(entity.target.paneId))
      return invalid(
        `sidebar '${entity.id}' targets unknown pane '${entity.target.paneId}'`,
      );
  }
  const root = await args.filesystem.realpath(args.directory);
  if (root instanceof Error)
    return invalid("cannot resolve plugin directory", root);
  for (const pane of args.contributes.panes) {
    const entry = pane.content.entry;
    if (isAbsolute(entry))
      return invalid(
        `pane '${pane.id}' entry must be relative to the plugin directory`,
      );
    const file = await args.filesystem.realpath(resolve(root, entry));
    if (file instanceof Error)
      return invalid(`cannot resolve pane '${pane.id}' entry '${entry}'`, file);
    const local = relative(root, file);
    if (local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local))
      return invalid(
        `pane '${pane.id}' entry must stay inside the plugin directory`,
      );
    const stat = await args.filesystem.stat(file);
    if (stat instanceof Error)
      return invalid(`cannot read pane '${pane.id}' entry '${entry}'`, stat);
    if (!stat.isFile())
      return invalid(`pane '${pane.id}' entry must be a file`);
  }
}

function resolvePluginEntry(args: {
  filesystem: FilesystemService;
  id: string;
  directory: string;
  kind: "view" | "server";
  explicit: string | undefined;
  fallbacks: readonly string[];
}) {
  if (args.explicit !== undefined) {
    const path = join(args.directory, args.explicit);
    if (!args.filesystem.exists(path)) {
      return new PluginManifestError({
        id: args.id,
        detail: `missing ${args.kind} file ${args.explicit}`,
      });
    }
    return path;
  }

  for (const relativePath of args.fallbacks) {
    const path = join(args.directory, relativePath);
    if (args.filesystem.exists(path)) return path;
  }
  return undefined;
}
