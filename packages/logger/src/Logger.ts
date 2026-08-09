import { appendFileSync } from "node:fs";

export type LogLevel = "debug" | "info" | "warn" | "log" | "error";

export type LoggerData = Record<string, unknown>;

export type LoggerEntry = {
  timestamp: string;
  level: LogLevel;
  data: LoggerData;
};

export type LoggerSinkApi = {
  log: (entry: LoggerEntry) => void;
  destroy?: () => void;
};

export type LoggerApi = {
  debug: (data: LoggerData) => void;
  info: (data: LoggerData) => void;
  warn: (data: LoggerData) => void;
  log: (data: LoggerData) => void;
  error: (data: LoggerData) => void;
};

type LoggerArgs = {
  sinks?: readonly LoggerSinkApi[];
  scopes?: LoggerData;
};

function createLogEntry(
  level: LogLevel,
  scopes: LoggerData,
  data: LoggerData,
): LoggerEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    data: {
      ...scopes,
      ...data,
    },
  };
}

function serializeLogValue(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => serializeLogValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      serializeLogValue(entryValue, seen),
    ]),
  );
}

export class Logger implements LoggerApi {
  private readonly sinks: readonly LoggerSinkApi[];
  private readonly scopes: LoggerData;

  constructor({ sinks = [], scopes = {} }: LoggerArgs = {}) {
    this.sinks = sinks;
    this.scopes = scopes;
  }

  debug(data: LoggerData) {
    this.write("debug", data);
  }

  info(data: LoggerData) {
    this.write("info", data);
  }

  warn(data: LoggerData) {
    this.write("warn", data);
  }

  log(data: LoggerData) {
    this.write("log", data);
  }

  error(data: LoggerData) {
    this.write("error", data);
  }

  scope(name: string, data: LoggerData = {}): Logger {
    return new Logger({
      sinks: this.sinks,
      scopes: {
        ...this.scopes,
        [name]: data,
      },
    });
  }

  addSink(sink: LoggerSinkApi): Logger {
    return new Logger({
      sinks: [...this.sinks, sink],
      scopes: this.scopes,
    });
  }

  destroy() {
    for (const sink of new Set(this.sinks)) {
      sink.destroy?.();
    }
  }

  private write(level: LogLevel, data: LoggerData) {
    const entry = createLogEntry(level, this.scopes, data);
    for (const sink of this.sinks) {
      sink.log(entry);
    }
  }
}

export class ConsoleLoggerSink implements LoggerSinkApi {
  log(entry: LoggerEntry) {
    console[entry.level](entry);
  }
}

export class JsonlLoggerSink implements LoggerSinkApi {
  private readonly filePath: string;

  constructor({ filePath }: { filePath: string }) {
    this.filePath = filePath;
  }

  log(entry: LoggerEntry) {
    appendFileSync(
      this.filePath,
      `${JSON.stringify(serializeLogValue(entry))}\n`,
    );
  }
}
