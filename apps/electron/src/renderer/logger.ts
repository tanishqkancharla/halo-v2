import { Logger, type LoggerEntry, type LoggerSinkApi } from "@repo/logger";
import { LOG_CHANNELS } from "../shared/channels.js";

class MainProcessLoggerSink implements LoggerSinkApi {
  log(entry: LoggerEntry) {
    window.postMessage(
      {
        channel: LOG_CHANNELS.log,
        payload: { level: entry.level, data: entry.data },
      },
      "*",
    );
  }
}

/** Forwards renderer logs to the main-process `logger.scope("renderer")`. */
export const logger = new Logger({
  sinks: [new MainProcessLoggerSink()],
});
