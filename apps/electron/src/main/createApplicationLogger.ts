import { ConsoleLoggerSink, JsonlLoggerSink, Logger } from "@repo/logger";
import { getLogFilePath, type ApplicationConfig } from "./ApplicationConfig.js";

export function createApplicationLogger(config: ApplicationConfig): Logger {
  return new Logger({
    sinks: [
      new ConsoleLoggerSink(),
      new JsonlLoggerSink({ filePath: getLogFilePath(config) }),
    ],
  });
}
