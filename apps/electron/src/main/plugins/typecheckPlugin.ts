import { readFile, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import * as errore from "errore";
import ts from "typescript6";

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
        csstype: [
          "./node_modules/@get-halo/plugin-sdk/bundled-types/csstype.d.ts",
        ],
        react: ["./node_modules/@get-halo/plugin-sdk/bundled-types/index.d.ts"],
        "react/jsx-runtime": [
          "./node_modules/@get-halo/plugin-sdk/bundled-types/jsx-runtime.d.ts",
        ],
        "react/jsx-dev-runtime": [
          "./node_modules/@get-halo/plugin-sdk/bundled-types/jsx-runtime.d.ts",
        ],
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
