import { basename, join, relative } from "node:path";
import * as errore from "errore";
import ts from "typescript6";
import type { FilesystemService } from "../filesystem/FilesystemService.js";

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

export async function writePluginTsconfig(args: {
  filesystem: FilesystemService;
  directory: string;
}) {
  const written = await args.filesystem.writeFile(
    join(args.directory, "tsconfig.json"),
    pluginTsconfig,
  );
  if (written instanceof Error) {
    return new PluginTypesError({
      detail: "write tsconfig.json",
      cause: written,
    });
  }
}

export async function typecheckPlugin(args: {
  filesystem: FilesystemService;
  directory: string;
}) {
  const configPath = join(args.directory, "tsconfig.json");
  const raw = await args.filesystem.readFile(configPath, "utf8");
  if (raw instanceof Error) {
    return new PluginTypesError({
      detail: "read tsconfig.json",
      cause: raw,
    });
  }

  const parsed = ts.parseConfigFileTextToJson(configPath, raw);
  if (parsed.error !== undefined) {
    return [
      diagnosticFields({
        directory: args.directory,
        diagnostic: parsed.error,
      }),
    ];
  }

  const config = ts.parseJsonConfigFileContent(
    parsed.config,
    ts.sys,
    args.directory,
    undefined,
    configPath,
  );
  if (config.errors.length > 0) {
    return config.errors.map((diagnostic) =>
      diagnosticFields({ directory: args.directory, diagnostic }),
    );
  }

  // TypeScript 7 has no in-process createProgram. typescript6 is 5.9.
  const program = ts.createProgram({
    rootNames: config.fileNames,
    options: config.options,
  });
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      diagnosticFields({ directory: args.directory, diagnostic }),
    );
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
