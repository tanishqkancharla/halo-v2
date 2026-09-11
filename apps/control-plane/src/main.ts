import fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import { ControlPlane } from "./ControlPlane.js";
import {
  controlPlaneConfigSchema,
  type ControlPlaneConfig,
} from "./ControlPlaneConfig.js";

const developmentPort = 8787;

class ControlPlaneStartupError extends errore.createTaggedError({
  name: "ControlPlaneStartupError",
  message: "Control plane startup failed: $detail",
}) {}

async function readConfiguration(): Promise<ControlPlaneConfig | Error> {
  const configPath = process.argv[2];
  if (configPath === undefined) return developmentConfiguration();
  const raw = await fs
    .readFile(configPath, "utf8")
    .catch(
      (cause) =>
        new ControlPlaneStartupError({ detail: "read configuration", cause }),
    );
  if (raw instanceof Error) return raw;
  const config = errore.try({
    // SAFETY: JSON.parse is untyped; controlPlaneConfigSchema validates the result below.
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) =>
      new ControlPlaneStartupError({ detail: "parse configuration", cause }),
  });
  if (config instanceof Error) return config;
  if (!Value.Check(controlPlaneConfigSchema, config))
    return new ControlPlaneStartupError({ detail: "invalid configuration" });
  return config;
}

function developmentConfiguration(): ControlPlaneConfig {
  const repositoryRoot = resolve(import.meta.dirname, "../../..");
  const appDataDir =
    process.env.HALO_USER_DATA === undefined
      ? join(repositoryRoot, ".halo")
      : resolve(process.env.HALO_USER_DATA);
  return {
    appDataDir,
    port: developmentPort,
  };
}

async function run() {
  const stopping = new Promise<void>((stop) => {
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    process.once("disconnect", stop);
    process.on("message", (message) => {
      if (message === "shutdown") stop();
    });
  });
  const config = await readConfiguration();
  if (config instanceof Error) return config;
  const plane = await ControlPlane.start(config);
  if (plane instanceof Error) return plane;
  await using cleanup = new errore.AsyncDisposableStack();
  cleanup.defer(async () => {
    const closed = await plane.close();
    if (closed instanceof Error) console.error(closed);
  });
  console.log(`Control plane listening at ${plane.origin}`);
  if (process.connected) process.send?.({ origin: plane.origin });
  await stopping;
}

// oxlint-disable-next-line typescript/no-floating-promises -- This entry point owns the process lifetime and exits after service cleanup.
run().then((result) => {
  if (result instanceof Error) console.error(result);
  process.exit(result instanceof Error ? 1 : 0);
});
