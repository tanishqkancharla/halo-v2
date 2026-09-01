import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const pluginTypePackages = [
  "maui",
  "wouter",
  "react",
  "@types/react",
  "csstype",
  "purse-styles",
] as const;

export async function copyPluginWorkspacePackages(pluginDir: string) {
  for (const packageName of pluginTypePackages) {
    const dest = join(pluginDir, "node_modules", ...packageName.split("/"));
    await mkdir(dirname(dest), { recursive: true });
    await cp(packageDirectory(packageName), dest, {
      recursive: true,
      dereference: true,
    });
  }
}

function packageDirectory(packageName: string) {
  const resolved =
    packageName === "wouter"
      ? require.resolve("wouter")
      : require.resolve(`${packageName}/package.json`);
  let directory = dirname(resolved);
  while (!existsSync(join(directory, "package.json"))) {
    directory = dirname(directory);
  }
  return directory;
}
