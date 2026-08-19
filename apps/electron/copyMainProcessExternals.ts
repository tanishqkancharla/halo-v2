import { createRequire } from "node:module";
import { cp, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as errore from "errore";
import { mainProcessExternals } from "./mainExternals.js";

const electronDir = path.dirname(fileURLToPath(import.meta.url));
const requireFromElectron = createRequire(
  path.join(electronDir, "package.json"),
);

type PackageJson = {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

/**
 * Copy Vite-external main-process packages (and their runtime closure) into
 * the packaged app so require() resolves after Forge Vite's `.vite`-only pack.
 */
export async function copyMainProcessExternals(
  buildPath: string,
): Promise<void> {
  const copied = new Set<string>();
  for (const packageName of mainProcessExternals) {
    await copyPackageClosure(buildPath, packageName, copied);
  }
}

async function copyPackageClosure(
  buildPath: string,
  packageName: string,
  copied: Set<string>,
): Promise<void> {
  if (copied.has(packageName)) return;

  const packageJsonPath = requireFromElectron.resolve(
    `${packageName}/package.json`,
  );
  const sourceDir = path.dirname(packageJsonPath);
  const destDir = path.join(
    buildPath,
    "node_modules",
    ...packageName.split("/"),
  );
  await mkdir(path.dirname(destDir), { recursive: true });
  await cp(sourceDir, destDir, { recursive: true, dereference: true });
  copied.add(packageName);

  const packageJsonRaw = await readFile(packageJsonPath, "utf8");
  const packageJson = errore.try({
    try: () => JSON.parse(packageJsonRaw),
    catch: (e) => new Error("Failed to parse package.json", { cause: e }),
  });
  if (packageJson instanceof Error) throw packageJson;

  for (const dependencyName of dependencyNames(packageJson.dependencies)) {
    await copyPackageClosure(buildPath, dependencyName, copied);
  }

  for (const dependencyName of dependencyNames(
    packageJson.optionalDependencies,
  )) {
    const resolved = errore.try({
      try: () => requireFromElectron.resolve(`${dependencyName}/package.json`),
      catch: (e) =>
        new Error("Could not resolve optional dependency", { cause: e }),
    });
    if (resolved instanceof Error) continue;
    await copyPackageClosure(buildPath, dependencyName, copied);
  }
}

function dependencyNames(dependencies: PackageJson["dependencies"]) {
  if (dependencies === undefined) return [];
  return Object.keys(dependencies);
}
