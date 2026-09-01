import { existsSync } from "node:fs";
import { cp, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import {
  mainProcessDiskPackages,
  mainProcessExternals,
  pluginHostDiskPackages,
  pluginSdkJitiDependencies,
} from "./mainExternals.js";

const electronDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const requireFromElectron = createRequire(
  path.join(electronDir, "package.json"),
);

const packageJsonSchema = Type.Object({
  dependencies: Type.Optional(Type.Record(Type.String(), Type.String())),
  optionalDependencies: Type.Optional(
    Type.Record(Type.String(), Type.String()),
  ),
});

class PackageJsonReadError extends errore.createTaggedError({
  name: "PackageJsonReadError",
  message: "Failed to read package.json for $packageName",
}) {}

/**
 * Copy Vite-external main-process packages (and their runtime closure) into
 * the packaged app so require() resolves after Forge Vite's `.vite`-only pack.
 * Also copy @halo/plugin-sdk for jiti; the host still bundles that package.
 */
export async function copyMainProcessExternals(
  buildPath: string,
): Promise<void> {
  const copied = new Set<string>();
  for (const packageName of mainProcessExternals) {
    await copyPackageClosure(buildPath, packageName, copied);
  }
  for (const packageName of mainProcessDiskPackages) {
    await copyPackage(buildPath, packageName, copied);
  }
  for (const packageName of pluginSdkJitiDependencies) {
    await copyPackageClosure(buildPath, packageName, copied);
  }
  for (const packageName of pluginHostDiskPackages) {
    await copyPackage(buildPath, packageName, copied);
  }
}

async function copyPackage(
  buildPath: string,
  packageName: string,
  copied: Set<string>,
): Promise<string | undefined> {
  if (copied.has(packageName)) return;
  const packageJsonPath = resolvePackageJson(packageName);
  const sourceDir = path.dirname(packageJsonPath);
  const destDir = path.join(
    buildPath,
    "node_modules",
    ...packageName.split("/"),
  );
  await mkdir(path.dirname(destDir), { recursive: true });
  await cp(sourceDir, destDir, { recursive: true, dereference: true });
  copied.add(packageName);
  return packageJsonPath;
}

async function copyPackageClosure(
  buildPath: string,
  packageName: string,
  copied: Set<string>,
): Promise<void> {
  if (copied.has(packageName)) return;

  const packageJsonPath = await copyPackage(buildPath, packageName, copied);
  if (packageJsonPath === undefined) return;

  const packageJsonRaw = await readFile(packageJsonPath, "utf8");
  const packageJson = errore.try({
    try: () => {
      // SAFETY: JSON.parse is untyped; packageJsonSchema is the file contract.
      return JSON.parse(packageJsonRaw) as unknown;
    },
    catch: (e) => new PackageJsonReadError({ packageName, cause: e }),
  });
  if (packageJson instanceof Error) throw packageJson;
  if (!Value.Check(packageJsonSchema, packageJson)) return;

  const dependencies = packageJson.dependencies;
  if (dependencies !== undefined) {
    for (const dependencyName of Object.keys(dependencies)) {
      await copyPackageClosure(buildPath, dependencyName, copied);
    }
  }

  const optionalDependencies = packageJson.optionalDependencies;
  if (optionalDependencies !== undefined) {
    for (const dependencyName of Object.keys(optionalDependencies)) {
      const resolved = errore.try({
        try: () => resolvePackageJson(dependencyName),
        catch: (e) =>
          new PackageJsonReadError({ packageName: dependencyName, cause: e }),
      });
      if (resolved instanceof Error) continue;
      await copyPackageClosure(buildPath, dependencyName, copied);
    }
  }
}

function resolvePackageJson(packageName: string) {
  const searchPaths = requireFromElectron.resolve.paths(packageName);
  if (searchPaths === null) {
    throw new PackageJsonReadError({ packageName });
  }
  for (const searchPath of searchPaths) {
    const candidate = path.join(
      searchPath,
      ...packageName.split("/"),
      "package.json",
    );
    if (existsSync(candidate)) return candidate;
  }
  throw new PackageJsonReadError({ packageName });
}
