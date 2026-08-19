import * as esbuild from "esbuild";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as errore from "errore";
import { extensionHostModules } from "../shared/extension.ts";

export const extensionEntryFileNames = [
  "index.tsx",
  "index.ts",
  "index.jsx",
  "index.js",
] as const;

export class ExtensionCompileError extends errore.createTaggedError({
  name: "ExtensionCompileError",
  message: "Failed to compile extension '$id': $detail",
}) {}

export class ExtensionEntryMissingError extends errore.createTaggedError({
  name: "ExtensionEntryMissingError",
  message: "Extension '$id' has no index.tsx, index.ts, index.jsx, or index.js",
}) {}

export function findExtensionEntry(directory: string) {
  for (const fileName of extensionEntryFileNames) {
    const path = join(directory, fileName);
    if (existsSync(path)) return path;
  }
  return undefined;
}

export async function compileExtensionDirectory({
  id,
  directory,
}: {
  id: string;
  directory: string;
}) {
  const entryPath = findExtensionEntry(directory);
  if (entryPath === undefined) return new ExtensionEntryMissingError({ id });

  const built = await esbuild
    .build({
      absWorkingDir: directory,
      entryPoints: [entryPath],
      bundle: true,
      write: false,
      format: "cjs",
      platform: "browser",
      jsx: "automatic",
      target: "es2022",
      logLevel: "silent",
      external: [...extensionHostModules],
    })
    .catch((e) => {
      const detail = e instanceof Error ? e.message : String(e);
      return new ExtensionCompileError({ id, detail, cause: e });
    });
  if (built instanceof Error) return built;

  const file = built.outputFiles[0];
  if (file === undefined) {
    return new ExtensionCompileError({
      id,
      detail: "esbuild produced no output",
    });
  }
  return { id, source: file.text };
}
