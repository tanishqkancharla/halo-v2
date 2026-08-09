import { app } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export type ApplicationConfig = {
  isDevelopment: boolean;
  dataDir: string;
  logsDir: string;
};

export function getApplicationConfig(env: {
  isDevelopment: boolean;
}): ApplicationConfig {
  const dataDir = app.getPath("userData");
  const logsDir = join(dataDir, "logs");
  mkdirSync(logsDir, { recursive: true });
  return {
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
