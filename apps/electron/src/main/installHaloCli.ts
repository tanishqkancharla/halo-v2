import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as errore from "errore";

export class InstallHaloCliError extends errore.createTaggedError({
  name: "InstallHaloCliError",
  message: "Failed to install halo CLI: $detail",
}) {}

export function haloCliBinDir(workspaceRoot: string) {
  return join(workspaceRoot, ".halo", "bin");
}

export function haloCliBinPath(workspaceRoot: string) {
  return join(haloCliBinDir(workspaceRoot), "halo");
}

export const haloCliResourceName = "halo-cli.cjs";

export function resolveHaloCliEntry(fromMainUrl: string) {
  const electronRoot = join(dirname(fileURLToPath(fromMainUrl)), "../..");
  const destCli = join(electronRoot, "../../packages/halo-cli/src/cli.ts");
  if (existsSync(destCli)) return destCli;
  const resourcesDir =
    process.platform === "darwin"
      ? join(dirname(process.execPath), "..", "Resources")
      : join(dirname(process.execPath), "resources");
  const packaged = join(resourcesDir, haloCliResourceName);
  if (existsSync(packaged)) return packaged;
  return undefined;
}

export function readInstalledHaloVersion(script: string) {
  const node = /process\.env\.HALO_VERSION = "([^"]+)"/.exec(script);
  if (node !== null) return node[1];
  const shell = /^export HALO_VERSION='([^']+)'/m.exec(script);
  if (shell === null) return undefined;
  return shell[1];
}

export function haloCliWrapper(args: {
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

export function resolveHaloCliImportHook(cliEntry: string) {
  if (!cliEntry.endsWith(".ts")) return undefined;
  const require = createRequire(pathToFileURL(cliEntry).href);
  return errore.try({
    try: () => require.resolve("tsx"),
    catch: (e) =>
      new InstallHaloCliError({ detail: "could not resolve tsx", cause: e }),
  });
}

export async function installHaloCli(args: {
  workspaceRoot: string;
  appVersion: string;
  cliEntry: string;
  nodeExecutable?: string;
  electronRunAsNode?: boolean;
}) {
  const binPath = haloCliBinPath(args.workspaceRoot);
  if (existsSync(binPath)) {
    const existing = await readFile(binPath, "utf8").catch(
      (e) => new InstallHaloCliError({ detail: "read halo", cause: e }),
    );
    if (existing instanceof Error) return existing;
    if (readInstalledHaloVersion(existing) === args.appVersion) return binPath;
  }

  const importHook = resolveHaloCliImportHook(args.cliEntry);
  if (importHook instanceof Error) return importHook;

  const created = await mkdir(haloCliBinDir(args.workspaceRoot), {
    recursive: true,
  }).catch((e) => new InstallHaloCliError({ detail: "mkdir bin", cause: e }));
  if (created instanceof Error) return created;

  const script = haloCliWrapper({
    appVersion: args.appVersion,
    cliEntry: args.cliEntry,
    importHook,
    nodeExecutable:
      args.nodeExecutable === undefined ? "node" : args.nodeExecutable,
    electronRunAsNode: args.electronRunAsNode === true,
  });
  const written = await writeFile(binPath, script, { mode: 0o755 }).catch(
    (e) => new InstallHaloCliError({ detail: "write halo", cause: e }),
  );
  if (written instanceof Error) return written;
  const mode = await chmod(binPath, 0o755).catch(
    (e) => new InstallHaloCliError({ detail: "chmod halo", cause: e }),
  );
  if (mode instanceof Error) return mode;
  return binPath;
}
