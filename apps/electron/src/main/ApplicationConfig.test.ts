import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { getApplicationConfig, getLogFilePath } from "./ApplicationConfig.js";

describe("getApplicationConfig", () => {
  test("puts logs under the data directory", () => {
    const dataDir = join("/tmp", "halo-app-config-data");
    const config = getApplicationConfig({
      isDevelopment: true,
      dataDir,
    });

    expect(config).toEqual({
      isDevelopment: true,
      dataDir,
      logsDir: join(dataDir, "logs"),
    });
  });
});

describe("getLogFilePath", () => {
  test("segments development logs by utc day", () => {
    const config = getApplicationConfig({
      isDevelopment: true,
      dataDir: join("/tmp", "halo-app-config-dev"),
    });

    expect(getLogFilePath(config, new Date("2026-08-09T15:30:00.000Z"))).toBe(
      join(config.logsDir, "2026-08-09.jsonl"),
    );
  });

  test("uses a single application log file in production", () => {
    const config = getApplicationConfig({
      isDevelopment: false,
      dataDir: join("/tmp", "halo-app-config-prod"),
    });

    expect(getLogFilePath(config)).toBe(join(config.logsDir, "halo.jsonl"));
  });
});
