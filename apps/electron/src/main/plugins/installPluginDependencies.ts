import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as errore from "errore";

const execFileAsync = promisify(execFile);

export class PluginDependencyInstallError extends errore.createTaggedError({
  name: "PluginDependencyInstallError",
  message: "Failed to install plugin dependencies",
}) {}

export async function installPluginDependencies(directory: string) {
  const installed = await execFileAsync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--legacy-peer-deps",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
    ],
    { cwd: directory },
  ).catch((e) => new PluginDependencyInstallError({ cause: e }));
  if (installed instanceof Error) return installed;
}
