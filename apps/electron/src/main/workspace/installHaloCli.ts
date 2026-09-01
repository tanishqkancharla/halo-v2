import * as errore from "errore";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FilesystemService } from "../filesystem/FilesystemService.js";

export class InstallHaloCliError extends errore.createTaggedError({
  name: "InstallHaloCliError",
  message: "Failed to install halo CLI: $detail",
}) {}

export function haloCliBinDir(workspaceRoot: string) {
  return join(workspaceRoot, ".halo", "bin");
}

function haloCliBinPath(workspaceRoot: string) {
  return join(haloCliBinDir(workspaceRoot), "halo");
}

export const haloCliResourceName = "halo-cli.cjs";

export function resolveHaloCliEntry(
  filesystem: FilesystemService,
  fromMainUrl: string,
) {
  const electronRoot = join(dirname(fileURLToPath(fromMainUrl)), "../..");
  const destCli = join(electronRoot, "../../packages/halo-cli/src/cli.ts");
  if (filesystem.exists(destCli)) return destCli;
  const resourcesDir =
    process.platform === "darwin"
      ? join(dirname(process.execPath), "..", "Resources")
      : join(dirname(process.execPath), "resources");
  const packaged = join(resourcesDir, haloCliResourceName);
  if (filesystem.exists(packaged)) return packaged;
  return undefined;
}

function readInstalledHaloVersion(script: string) {
  const node = /process\.env\.HALO_VERSION = "([^"]+)"/.exec(script);
  if (node !== null) return node[1];
  const shell = /^export HALO_VERSION='([^']+)'/m.exec(script);
  if (shell === null) return undefined;
  return shell[1];
}

function wrapHaloCli(args: {
  appVersion: string;
  cliEntry: string;
  importHook?: string;
  nodeExecutable: string;
  electronRunAsNode: boolean;
}) {
  const nodeArgs =
    args.importHook === undefined
      ? [args.cliEntry]
      : ["--import", args.importHook, args.cliEntry];
  // Electron treats extra argv as app args unless this is set, and then runs
  // as Node using this same binary.
  const runAsNode = args.electronRunAsNode
    ? "export ELECTRON_RUN_AS_NODE=1\n"
    : "";
  return `#!/bin/sh
export HALO_VERSION=${shQuote(args.appVersion)}
${runAsNode}exec ${shQuote(args.nodeExecutable)} ${nodeArgs.map(shQuote).join(" ")} "$@"
`;
}

function shQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function resolveHaloCliImportHook(cliEntry: string) {
  if (!cliEntry.endsWith(".ts")) return undefined;
  const require = createRequire(pathToFileURL(cliEntry).href);
  return errore.try({
    try: () => require.resolve("tsx"),
    catch: (e) =>
      new InstallHaloCliError({ detail: "could not resolve tsx", cause: e }),
  });
}

export async function installHaloCli(args: {
  filesystem: FilesystemService;
  workspaceRoot: string;
  appVersion: string;
  cliEntry: string;
  nodeExecutable?: string;
  electronRunAsNode?: boolean;
}) {
  const binPath = haloCliBinPath(args.workspaceRoot);
  if (args.filesystem.exists(binPath)) {
    const existing = await args.filesystem.readTextFile(binPath);
    if (existing instanceof Error) {
      return new InstallHaloCliError({ detail: "read halo", cause: existing });
    }
    if (readInstalledHaloVersion(existing) === args.appVersion) return binPath;
  }

  const importHook = resolveHaloCliImportHook(args.cliEntry);
  if (importHook instanceof Error) return importHook;

  const created = await args.filesystem.makeDirectory(
    haloCliBinDir(args.workspaceRoot),
    {
      recursive: true,
    },
  );
  if (created instanceof Error) {
    return new InstallHaloCliError({ detail: "mkdir bin", cause: created });
  }

  const script = wrapHaloCli({
    appVersion: args.appVersion,
    cliEntry: args.cliEntry,
    importHook,
    nodeExecutable:
      args.nodeExecutable === undefined ? "node" : args.nodeExecutable,
    electronRunAsNode: args.electronRunAsNode === true,
  });
  const written = await args.filesystem.writeFile(binPath, script, {
    mode: 0o755,
  });
  if (written instanceof Error) {
    return new InstallHaloCliError({ detail: "write halo", cause: written });
  }
  const mode = await args.filesystem.chmod(binPath, 0o755);
  if (mode instanceof Error) {
    return new InstallHaloCliError({ detail: "chmod halo", cause: mode });
  }
  return binPath;
}
