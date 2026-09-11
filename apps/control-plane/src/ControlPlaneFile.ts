import fs from "node:fs/promises";
import { join } from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";

const controlPlaneFileSchema = Type.Object({
  origin: Type.String(),
});

type ControlPlaneFile = Static<typeof controlPlaneFileSchema>;

class ControlPlaneFileError extends errore.createTaggedError({
  name: "ControlPlaneFileError",
  message: "Control-plane origin file: $operation",
}) {}

function controlPlaneFilePath(appDataDir: string) {
  return join(appDataDir, "control-plane.json");
}

export async function readControlPlaneFile(appDataDir: string) {
  const raw = await fs
    .readFile(controlPlaneFilePath(appDataDir), "utf8")
    .catch((cause: NodeJS.ErrnoException) =>
      cause.code === "ENOENT"
        ? undefined
        : new ControlPlaneFileError({ operation: "read", cause }),
    );
  if (raw === undefined || raw instanceof Error) return raw;
  const parsed = errore.try({
    // SAFETY: JSON.parse is untyped; controlPlaneFileSchema validates the published origin.
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) => new ControlPlaneFileError({ operation: "parse", cause }),
  });
  if (parsed instanceof Error) return parsed;
  if (!Value.Check(controlPlaneFileSchema, parsed))
    return new ControlPlaneFileError({ operation: "invalid origin" });
  return parsed;
}

export async function writeControlPlaneFile(ctx: {
  appDataDir: string;
  origin: string;
}) {
  const created = await fs
    .mkdir(ctx.appDataDir, { recursive: true })
    .catch(
      (cause) => new ControlPlaneFileError({ operation: "create", cause }),
    );
  if (created instanceof Error) return created;
  const destination = controlPlaneFilePath(ctx.appDataDir);
  const published: ControlPlaneFile = { origin: ctx.origin };
  const written = await fs
    .writeFile(`${destination}.tmp`, JSON.stringify(published), {
      mode: 0o600,
    })
    .catch((cause) => new ControlPlaneFileError({ operation: "write", cause }));
  if (written instanceof Error) return written;
  return await fs
    .rename(`${destination}.tmp`, destination)
    .catch(
      (cause) => new ControlPlaneFileError({ operation: "publish", cause }),
    );
}

export async function removeControlPlaneFile(appDataDir: string) {
  return await fs
    .rm(controlPlaneFilePath(appDataDir), { force: true })
    .catch(
      (cause) => new ControlPlaneFileError({ operation: "remove", cause }),
    );
}
