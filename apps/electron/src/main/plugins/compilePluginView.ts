import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import * as errore from "errore";
import type { CompiledPluginView } from "../../shared/plugin.js";

const viewExternals = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "maui",
  "purse-styles",
  "wouter",
  "@halo/plugin-sdk/view",
] as const;

export class PluginViewCompileError extends errore.createTaggedError({
  name: "PluginViewCompileError",
  message: "Plugin '$id' view failed to compile: $detail",
}) {}

export async function compilePluginView(args: {
  id: string;
  directory: string;
  viewPath: string;
}): Promise<PluginViewCompileError | CompiledPluginView> {
  const esbuild = await loadEsbuild();
  const built = await Promise.resolve()
    .then(() =>
      esbuild.build({
        absWorkingDir: args.directory,
        entryPoints: [args.viewPath],
        bundle: true,
        write: false,
        format: "cjs",
        platform: "browser",
        jsx: "automatic",
        logLevel: "silent",
        external: [...viewExternals],
      }),
    )
    .catch(
      (e) =>
        new PluginViewCompileError({
          id: args.id,
          detail: String(e),
          cause: e,
        }),
    );
  if (built instanceof Error) return built;

  const output = built.outputFiles[0];
  if (built.errors.length > 0 || output === undefined) {
    const first = built.errors[0];
    return new PluginViewCompileError({
      id: args.id,
      detail: first === undefined ? "esbuild produced no output" : first.text,
    });
  }

  return { id: args.id, source: output.text };
}

let esbuildModule: Promise<typeof import("esbuild")> | undefined;

function loadEsbuild() {
  if (esbuildModule !== undefined) return esbuildModule;
  // esbuild reads ESBUILD_BINARY_PATH when the module loads. spawn() cannot
  // run the copy stored inside the asar (ENOTDIR).
  const binaryPath = packagedEsbuildBinary();
  if (binaryPath !== undefined) {
    process.env.ESBUILD_BINARY_PATH = binaryPath;
  }
  esbuildModule = import("esbuild");
  return esbuildModule;
}

function packagedEsbuildBinary() {
  const binaryName = process.platform === "win32" ? "esbuild.exe" : "esbuild";
  const resourcesDir =
    process.platform === "darwin"
      ? join(dirname(process.execPath), "..", "Resources")
      : join(dirname(process.execPath), "resources");
  const binaryPath = join(
    resourcesDir,
    "app.asar.unpacked",
    "node_modules",
    "esbuild",
    "bin",
    binaryName,
  );
  if (!existsSync(binaryPath)) return undefined;
  return binaryPath;
}
