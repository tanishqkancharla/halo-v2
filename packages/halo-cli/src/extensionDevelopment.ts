import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import * as errore from "errore";

const exec = promisify(execFile);

class ExtensionDevelopmentError extends errore.createTaggedError({
  name: "ExtensionDevelopmentError",
  message: "Could not prepare local extension packages: $detail",
}) {}

export async function packDevelopmentExtensions(args: {
  sourceDirectory: string;
  workspaceRoot: string;
}) {
  const directory = join(args.workspaceRoot, ".halo", "extension-packages");
  const created = await mkdir(directory, { recursive: true }).catch(
    (cause) =>
      new ExtensionDevelopmentError({ detail: "create package cache", cause }),
  );
  if (created instanceof Error) return created;
  const temporary = await mkdtemp(join(directory, "packing-")).catch(
    (cause) =>
      new ExtensionDevelopmentError({
        detail: "create packing directory",
        cause,
      }),
  );
  if (temporary instanceof Error) return temporary;
  await using cleanup = new errore.AsyncDisposableStack();
  cleanup.defer(async () => {
    const removed = await rm(temporary, { recursive: true, force: true }).catch(
      (cause) =>
        new ExtensionDevelopmentError({
          detail: "clean packing directory",
          cause,
        }),
    );
    if (removed instanceof Error) console.warn(removed);
  });

  const pack = async (name: string) => {
    const cwd = join(args.sourceDirectory, name);
    const built = await exec("npm", ["run", "build"], { cwd }).catch(
      (cause) =>
        new ExtensionDevelopmentError({
          detail: `build ${name}: ${cause.message}`,
          cause,
        }),
    );
    if (built instanceof Error) return built;
    const packed = await exec(
      "npm",
      ["pack", "--ignore-scripts", "--pack-destination", temporary],
      { cwd },
    ).catch(
      (cause) =>
        new ExtensionDevelopmentError({
          detail: `pack ${name}: ${cause.message}`,
          cause,
        }),
    );
    if (packed instanceof Error) return packed;
    const tarball = join(temporary, packed.stdout.trim());
    const contents = await readFile(tarball).catch(
      (cause) =>
        new ExtensionDevelopmentError({ detail: `read ${name}`, cause }),
    );
    if (contents instanceof Error) return contents;
    // npm caches file dependencies; a content hash gives each SDK build its own identity.
    const digest = createHash("sha256").update(contents).digest("hex");
    const destination = join(directory, `${name}-${digest}.tgz`);
    const moved = await rename(tarball, destination).catch(
      (cause) =>
        new ExtensionDevelopmentError({ detail: `cache ${name}`, cause }),
    );
    if (moved instanceof Error) return moved;
    return `file:${destination}`;
  };

  const sdk = await pack("extension-sdk");
  if (sdk instanceof Error) return sdk;
  const tools = await pack("extension-tools");
  if (tools instanceof Error) return tools;
  return { sdk, tools };
}
