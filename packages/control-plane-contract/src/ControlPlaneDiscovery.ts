import fs from "node:fs/promises";
import { join } from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";

const controlPlaneDiscoverySchema = Type.Object({
  origin: Type.String(),
});

type ControlPlaneDiscovery = Static<typeof controlPlaneDiscoverySchema>;

class ControlPlaneDiscoveryError extends errore.createTaggedError({
  name: "ControlPlaneDiscoveryError",
  message: "Control-plane origin file: $operation",
}) {}

function controlPlaneFilePath(appDataDir: string) {
  return join(appDataDir, "control-plane.json");
}

export async function readControlPlaneDiscovery(appDataDir: string) {
  const raw = await fs
    .readFile(controlPlaneFilePath(appDataDir), "utf8")
    .catch((cause: NodeJS.ErrnoException) =>
      cause.code === "ENOENT"
        ? undefined
        : new ControlPlaneDiscoveryError({ operation: "read", cause }),
    );
  if (raw === undefined || raw instanceof Error) return raw;
  const parsed = errore.try({
    // SAFETY: JSON.parse is untyped; the schema validates the published origin below.
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) =>
      new ControlPlaneDiscoveryError({ operation: "parse", cause }),
  });
  if (parsed instanceof Error) return parsed;
  if (!Value.Check(controlPlaneDiscoverySchema, parsed))
    return new ControlPlaneDiscoveryError({ operation: "invalid origin" });
  return parsed;
}

export async function writeControlPlaneDiscovery(ctx: {
  appDataDir: string;
  origin: string;
}) {
  const created = await fs
    .mkdir(ctx.appDataDir, { recursive: true })
    .catch(
      (cause) => new ControlPlaneDiscoveryError({ operation: "create", cause }),
    );
  if (created instanceof Error) return created;
  const destination = controlPlaneFilePath(ctx.appDataDir);
  const published: ControlPlaneDiscovery = { origin: ctx.origin };
  const written = await fs
    .writeFile(`${destination}.tmp`, JSON.stringify(published), {
      mode: 0o600,
    })
    .catch(
      (cause) => new ControlPlaneDiscoveryError({ operation: "write", cause }),
    );
  if (written instanceof Error) return written;
  return await fs
    .rename(`${destination}.tmp`, destination)
    .catch(
      (cause) =>
        new ControlPlaneDiscoveryError({ operation: "publish", cause }),
    );
}

export async function removeControlPlaneDiscovery(appDataDir: string) {
  return await fs
    .rm(controlPlaneFilePath(appDataDir), { force: true })
    .catch(
      (cause) => new ControlPlaneDiscoveryError({ operation: "remove", cause }),
    );
}
