import { mkdirSync } from "node:fs";
import { join } from "node:path";

export type ApplicationConfig = {
  isDevelopment: boolean;
  dataDir: string;
  logsDir: string;
};

export type ApplicationConfigEnv = {
  isDevelopment: boolean;
  dataDir: string;
};

export function getApplicationConfig(
  env: ApplicationConfigEnv,
): ApplicationConfig {
  const config: ApplicationConfig = {
    isDevelopment: env.isDevelopment,
    dataDir: env.dataDir,
    logsDir: join(env.dataDir, "logs"),
  };
  mkdirSync(config.logsDir, { recursive: true });
  return config;
}

export function getLogFilePath(
  config: ApplicationConfig,
  now = new Date(),
): string {
  if (config.isDevelopment) {
    return join(config.logsDir, `${utcDay(now)}.jsonl`);
  }
  return join(config.logsDir, "halo.jsonl");
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}
