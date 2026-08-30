import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, relative } from "node:path";
import * as errore from "errore";
import ts from "typescript6";

const require = createRequire(import.meta.url);

function packageDirectory(entryPath: string) {
  let directory = dirname(entryPath);
  while (!existsSync(join(directory, "package.json"))) {
    directory = dirname(directory);
  }
  return directory;
}

const pluginTsconfig = `${JSON.stringify(
  {
    compilerOptions: {
      strict: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      jsx: "react-jsx",
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      skipLibCheck: true,
      paths: {
        csstype: [dirname(require.resolve("csstype/index.d.ts"))],
        maui: [dirname(require.resolve("maui/package.json"))],
        "purse-styles": [dirname(require.resolve("purse-styles/package.json"))],
        react: [dirname(require.resolve("@types/react/package.json"))],
        "react/*": [
          `${dirname(require.resolve("@types/react/package.json"))}/*`,
        ],
        wouter: [packageDirectory(require.resolve("wouter"))],
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

export async function writePluginTsconfig(directory: string) {
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
