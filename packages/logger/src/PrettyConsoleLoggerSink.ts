import type {
  LogLevel,
  LoggerEntry,
  LoggerSinkApi,
  LoggerValue,
} from "./Logger.js";

const colors = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function levelColor(level: LogLevel): string {
  if (level === "error") return colors.red;
  if (level === "warn") return colors.yellow;
  if (level === "debug") return colors.gray;
  return colors.blue;
}

function selectLogger(level: LogLevel) {
  if (level === "error") return console.error;
  if (level === "warn") return console.warn;
  if (level === "info") return console.info;
  if (level === "debug") return console.debug;
  return console.log;
}

function isStringValue(args: { value: LoggerValue | undefined }) {
  return {}.toString.call(args.value) === "[object String]";
}

export class PrettyConsoleLoggerSink implements LoggerSinkApi {
  log(entry: LoggerEntry) {
    const scopeLabel = entry.scopes
      .map((scope) => `${colors.cyan}[${scope.name}]${colors.reset}`)
      .join("");
    const eventField = entry.data.event;
    const event = (() => {
      if (!isStringValue({ value: eventField })) return "";
      // SAFETY: [object String] is a string primitive or String object.
      return eventField as string;
    })();
    const data: { [key: string]: LoggerValue } = {};
    for (const scope of entry.scopes) {
      Object.assign(data, scope.data);
    }
    for (const [key, value] of Object.entries(entry.data)) {
      if (key === "event") continue;
      data[key] = value;
    }

    const prefix = [
      `${colors.gray}${entry.timestamp}${colors.reset}`,
      `${levelColor(entry.level)}${entry.level.toUpperCase()}${colors.reset}`,
      scopeLabel,
      event,
    ]
      .filter((part) => part.length > 0)
      .join(" ");

    try {
      selectLogger(entry.level)(`${prefix} ${JSON.stringify(data)}`);
    } catch {
      // Ignore console transport failures (EIO/EPIPE); file sink remains authoritative.
    }
  }
}
