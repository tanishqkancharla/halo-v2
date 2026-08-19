import * as esbuild from "esbuild";
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
  const built = await esbuild
    .build({
      absWorkingDir: args.directory,
      entryPoints: [args.viewPath],
      bundle: true,
      write: false,
      format: "cjs",
      platform: "browser",
      jsx: "automatic",
      logLevel: "silent",
      external: [...viewExternals],
    })
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
