import { app } from "electron";
import { join } from "node:path";
import type { FilesystemService } from "@get-halo/workspace-server/filesystem";

const productionControlPlaneOrigin =
  "https://halo-dev-control-plane-912701444316.us-central1.run.app";

type ApplicationConfig = {
  controlPlane:
    | { deployment: "local" }
    | { deployment: "cloudRun"; origin: string };
  isDevelopment: boolean;
  dataDir: string;
  logsDir: string;
};

export function getApplicationConfig(env: {
  isDevelopment: boolean;
  filesystem: FilesystemService;
}): ApplicationConfig {
  const dataDir = app.getPath("userData");
  const logsDir = join(dataDir, "logs");
  const created = env.filesystem.makeDirectorySync(logsDir);
  if (created instanceof Error) throw created;
  return {
    controlPlane: env.isDevelopment
      ? { deployment: "local" }
      : { deployment: "cloudRun", origin: productionControlPlaneOrigin },
    isDevelopment: env.isDevelopment,
    dataDir,
    logsDir,
  };
}

export function getLogFilePath(
  config: ApplicationConfig,
  now = new Date(),
): string {
  if (config.isDevelopment) {
    return join(config.logsDir, `${now.toISOString().slice(0, 10)}.jsonl`);
  }
  return join(config.logsDir, "halo.jsonl");
}
