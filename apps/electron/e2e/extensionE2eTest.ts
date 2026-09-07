import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import * as errore from "errore";
import { e2eTest } from "./e2eTest.js";

const exec = promisify(execFile);
const repository = path.resolve(import.meta.dirname, "../../..");

class ExtensionSetupError extends errore.createTaggedError({
  name: "ExtensionSetupError",
  message: "Could not prepare workspace extension: $command",
}) {}

export const extensionE2eTest = e2eTest.extend<
  {},
  { extensionPackages: { sdk: string; tools: string } }
>({
  extensionPackages: [
    // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright fixture callbacks require destructured parameters.
    async ({}, use) => {
      const parent = path.join(repository, "tmp", "extension-host");
      await mkdir(parent, { recursive: true });
      const directory = await mkdtemp(path.join(parent, "packages-"));
      await using cleanup = new errore.AsyncDisposableStack();
      cleanup.defer(() => rm(directory, { recursive: true, force: true }));
      const packed: string[] = [];
      for (const name of ["extension-sdk", "extension-tools"]) {
        const cwd = path.join(repository, "packages", name);
        await command("npm", ["run", "build"], cwd);
        const result = await command(
          "npm",
          ["pack", "--ignore-scripts", "--pack-destination", directory],
          cwd,
        );
        packed.push(`file:${path.join(directory, result.stdout.trim())}`);
      }
      await use({ sdk: packed[0]!, tools: packed[1]! });
    },
    { scope: "worker", timeout: 180_000 },
  ],
  testArtifacts: async ({ testArtifacts, extensionPackages }, use) => {
    const { scaffoldExtension } =
      await import("@get-halo/extension-tools/scaffold");
    const parent = path.join(
      testArtifacts.paths.workspace,
      ".halo",
      "extensions",
    );
    await mkdir(parent, { recursive: true });
    const directory = path.join(parent, "starter");
    const scaffolded = await scaffoldExtension({
      directory,
      name: "starter",
      packages: extensionPackages,
    });
    if (scaffolded instanceof Error) throw scaffolded;
    await command(
      "pnpm",
      [
        "install",
        "--dir",
        directory,
        "--lockfile-dir",
        directory,
        "--ignore-workspace",
        "--ignore-scripts",
        "--config.manage-package-manager-versions=false",
      ],
      directory,
    );
    await command("npm", ["run", "build"], directory);
    await use(testArtifacts);
  },
});

async function command(executable: string, args: string[], cwd: string) {
  const result = await exec(executable, args, {
    cwd,
    maxBuffer: 4 * 1024 * 1024,
  }).catch(
    (cause) =>
      new ExtensionSetupError({
        command: `${executable} ${args.join(" ")}`,
        cause,
      }),
  );
  if (result instanceof Error) throw result;
  return result;
}
