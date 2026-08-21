import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
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

const mauiSourceExtensions = [".tsx", ".ts", ".jsx", ".js"] as const;
const requireFromThisFile = createRequire(import.meta.url);

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
      plugins: [haloMauiResolvePlugin()],
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

// maui's "./src/*": "./src/*" export has no extension. esbuild does not
// probe .ts after that rewrite, so maui/src/utils/memoize fails to resolve.
function haloMauiResolvePlugin(): esbuild.Plugin {
  return {
    name: "halo-maui-resolve",
    setup(build) {
      build.onResolve(
        { filter: /^(?:@tanishqkancharla\/)?maui(?:\/|$)/ },
        (args) => {
          const subpath = mauiSubpath(args.path);
          if (subpath === undefined) return;
          if (subpath === "" || subpath === "src") {
            return { path: "maui", external: true };
          }

          const root = haloMauiRoot();
          if (root instanceof Error) {
            return { errors: [{ text: root.message }] };
          }

          const file = resolveMauiSourceFile(root, subpath);
          if (file === undefined) {
            return {
              errors: [{ text: `Could not resolve ${args.path}` }],
            };
          }
          return { path: file };
        },
      );
    },
  };
}

function mauiSubpath(specifier: string) {
  if (specifier === "maui" || specifier === "@tanishqkancharla/maui") {
    return "";
  }
  const scopedPrefix = "@tanishqkancharla/maui/";
  if (specifier.startsWith(scopedPrefix)) {
    return specifier.slice(scopedPrefix.length);
  }
  const aliasPrefix = "maui/";
  if (specifier.startsWith(aliasPrefix)) {
    return specifier.slice(aliasPrefix.length);
  }
  return undefined;
}

function haloMauiRoot() {
  return errore.try({
    try: () => dirname(requireFromThisFile.resolve("maui/package.json")),
    catch: (e) =>
      new PluginViewCompileError({
        id: "maui",
        detail: "Halo's maui package is missing",
        cause: e,
      }),
  });
}

function resolveMauiSourceFile(root: string, subpath: string) {
  const base = join(root, subpath);
  const candidates =
    extname(base) === ""
      ? [base, ...mauiSourceExtensions.map((extension) => base + extension)]
      : [base];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}
