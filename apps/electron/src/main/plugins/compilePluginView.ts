import { dirname, join } from "node:path";
import * as errore from "errore";
import type { CompiledPluginView } from "@get-halo/shared/plugin";
import type { FilesystemService } from "../filesystem/FilesystemService.js";

const viewExternals = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "maui",
  "purse-styles",
  "wouter",
  "@get-halo/plugin-sdk/view",
  "@get-halo/plugin-sdk/storage",
] as const;

export class PluginViewCompileError extends errore.createTaggedError({
  name: "PluginViewCompileError",
  message: "Plugin '$id' view failed to compile: $detail",
}) {}

export class PluginViewDistError extends errore.createTaggedError({
  name: "PluginViewDistError",
  message: "Plugin '$id' is missing dist/view.js. Run halo plugin build.",
}) {}

export async function compilePluginView(args: {
  filesystem: FilesystemService;
  id: string;
  directory: string;
  viewPath: string;
  outfile: string;
}): Promise<PluginViewCompileError | { id: string; outfile: string }> {
  const esbuild = await loadEsbuild(args.filesystem);
  const built = await Promise.resolve()
    .then(() =>
      esbuild.build({
        absWorkingDir: args.directory,
        entryPoints: [args.viewPath],
        bundle: true,
        write: true,
        outfile: args.outfile,
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

  if (built.errors.length > 0) {
    const first = built.errors[0];
    return new PluginViewCompileError({
      id: args.id,
      detail: first === undefined ? "esbuild produced no output" : first.text,
    });
  }

  return { id: args.id, outfile: args.outfile };
}

export async function readPluginViewDist(args: {
  filesystem: FilesystemService;
  id: string;
  directory: string;
}): Promise<PluginViewDistError | CompiledPluginView> {
  const source = await args.filesystem.readFile(
    join(args.directory, "dist", "view.js"),
    "utf8",
  );
  if (source instanceof Error) {
    return new PluginViewDistError({ id: args.id, cause: source });
  }
  return { id: args.id, source };
}

let esbuildModule: Promise<typeof import("esbuild")> | undefined;

function loadEsbuild(filesystem: FilesystemService) {
  if (esbuildModule !== undefined) return esbuildModule;
  // esbuild reads ESBUILD_BINARY_PATH when the module loads. spawn() cannot
  // run the copy stored inside the asar (ENOTDIR).
  const binaryPath = packagedEsbuildBinary(filesystem);
  if (binaryPath !== undefined) {
    process.env.ESBUILD_BINARY_PATH = binaryPath;
  }
  esbuildModule = import("esbuild");
  return esbuildModule;
}

function packagedEsbuildBinary(filesystem: FilesystemService) {
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
  if (!filesystem.exists(binaryPath)) return undefined;
  return binaryPath;
}
