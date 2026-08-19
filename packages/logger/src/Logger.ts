export type LogLevel = "debug" | "info" | "warn" | "log" | "error";

export type LoggerValue =
  | string
  | number
  | boolean
  | undefined
  | Error
  | readonly LoggerValue[]
  | { readonly [key: string]: LoggerValue };

export type LoggerData = { readonly [key: string]: LoggerValue };

export type LoggerScope = { readonly [key: string]: LoggerData };

export type LoggerEntry = {
  timestamp: string;
  level: LogLevel;
  scopes: readonly LoggerScope[];
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
  scopes?: readonly LoggerScope[];
};

function createLogEntry(
  level: LogLevel,
  scopes: readonly LoggerScope[],
  data: LoggerData,
): LoggerEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    scopes,
    data,
  };
}

export class Logger implements LoggerApi {
  private readonly sinks: readonly LoggerSinkApi[];
  private readonly scopes: readonly LoggerScope[];

  constructor({ sinks = [], scopes = [] }: LoggerArgs = {}) {
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
      scopes: [...this.scopes, { [name]: data }],
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
