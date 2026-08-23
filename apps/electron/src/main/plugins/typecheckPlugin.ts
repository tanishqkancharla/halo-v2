import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import * as errore from "errore";
import ts from "typescript6";
import { bundledTypesDirectory } from "./bundledTypes.js";

const bundledTypeFiles = [
  "view.d.ts",
  "server.d.ts",
  "schema.d.ts",
  "jsx-runtime.d.ts",
] as const;

const pluginTsconfig = `${JSON.stringify(
  {
    compilerOptions: {
      strict: true,
      noEmit: true,
      jsx: "react-jsx",
      module: "ESNext",
      moduleResolution: "bundler",
      skipLibCheck: true,
      paths: {
        "@halo/plugin-sdk/view": ["./types/view.d.ts"],
        "@halo/plugin-sdk/server": ["./types/server.d.ts"],
        "@halo/plugin-sdk/schema": ["./types/schema.d.ts"],
        "react/jsx-runtime": ["./types/jsx-runtime.d.ts"],
        "react/jsx-dev-runtime": ["./types/jsx-runtime.d.ts"],
      },
    },
    include: ["*.ts", "*.tsx", "view/**/*", "server/**/*"],
  },
  undefined,
  2,
)}\n`;

export class PluginTypesError extends errore.createTaggedError({
  name: "PluginTypesError",
  message: "Plugin types failed: $detail",
}) {}

export async function writePluginTypes(directory: string) {
  const typesDir = join(directory, "types");
  const created = await mkdir(typesDir, { recursive: true }).catch(
    (e) => new PluginTypesError({ detail: "create types directory", cause: e }),
  );
  if (created instanceof Error) return created;

  const sourceDir = bundledTypesDirectory();
  for (const file of bundledTypeFiles) {
    const copied = await copyFile(
      join(sourceDir, file),
      join(typesDir, file),
    ).catch(
      (e) =>
        new PluginTypesError({
          detail: `copy ${file}`,
          cause: e,
        }),
    );
    if (copied instanceof Error) return copied;
  }

  return writeFile(join(directory, "tsconfig.json"), pluginTsconfig).catch(
    (e) => new PluginTypesError({ detail: "write tsconfig.json", cause: e }),
  );
}

export async function typecheckPlugin(directory: string) {
  const configPath = join(directory, "tsconfig.json");
  const raw = await readFile(configPath, "utf8").catch(
    (e) =>
      new PluginTypesError({
        detail: "read tsconfig.json",
        cause: e,
      }),
  );
  if (raw instanceof Error) return raw;

  const parsed = ts.parseConfigFileTextToJson(configPath, raw);
  if (parsed.error !== undefined) {
    return [
      diagnosticFields({
        directory,
        diagnostic: parsed.error,
      }),
    ];
  }

  const config = ts.parseJsonConfigFileContent(
    parsed.config,
    ts.sys,
    directory,
    undefined,
    configPath,
  );
  if (config.errors.length > 0) {
    return config.errors.map((diagnostic) =>
      diagnosticFields({ directory, diagnostic }),
    );
  }

  // TypeScript 7 has no in-process createProgram. typescript6 is 5.9.
  const program = ts.createProgram({
    rootNames: config.fileNames,
    options: config.options,
  });
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => diagnosticFields({ directory, diagnostic }));
}

function diagnosticFields(args: {
  directory: string;
  diagnostic: ts.Diagnostic;
}) {
  const file =
    args.diagnostic.file === undefined
      ? ""
      : relative(args.directory, args.diagnostic.file.fileName);
  const line =
    args.diagnostic.file === undefined || args.diagnostic.start === undefined
      ? 0
      : args.diagnostic.file.getLineAndCharacterOfPosition(
          args.diagnostic.start,
        ).line + 1;
  return {
    file: file.length === 0 ? basename(args.directory) : file,
    line,
    message: ts.flattenDiagnosticMessageText(args.diagnostic.messageText, "\n"),
  };
}
