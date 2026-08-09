import type { LogLevel, LoggerApi, LoggerData } from "@repo/logger";
import { LOG_CHANNELS } from "../shared/channels.js";

function send(level: LogLevel, data: LoggerData) {
  window.postMessage(
    {
      channel: LOG_CHANNELS.log,
      payload: { level, data },
    },
    "*",
  );
}

/** Forwards renderer logs to the main-process `logger.scope("renderer")`. */
export const logger: LoggerApi = {
  debug(data) {
    send("debug", data);
  },
  info(data) {
    send("info", data);
  },
  warn(data) {
    send("warn", data);
  },
  log(data) {
    send("log", data);
  },
  error(data) {
    send("error", data);
  },
};
