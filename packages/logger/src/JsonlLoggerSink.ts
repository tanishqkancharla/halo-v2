import { appendFileSync } from "node:fs";
import type {
  LoggerData,
  LoggerEntry,
  LoggerSinkApi,
  LoggerValue,
} from "./Logger.js";

type JsonLogValue =
  | string
  | number
  | boolean
  | undefined
  | JsonLogValue[]
  | { [key: string]: JsonLogValue };

function serializeLoggerValue(
  value: LoggerValue,
  seen: WeakSet<object>,
): JsonLogValue {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeLoggerValue(item, seen));
  }

  if (value instanceof Object) {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const result: { [key: string]: JsonLogValue } = {};
    for (const [key, entryValue] of Object.entries(value)) {
      result[key] = serializeLoggerValue(entryValue, seen);
    }
    return result;
  }

  return value;
}

function serializeLoggerData(data: LoggerData, seen: WeakSet<object>) {
  return serializeLoggerValue(data, seen);
}

export class JsonlLoggerSink implements LoggerSinkApi {
  private readonly filePath: string;

  constructor({ filePath }: { filePath: string }) {
    this.filePath = filePath;
  }

  log(entry: LoggerEntry) {
    const seen = new WeakSet<object>();
    appendFileSync(
      this.filePath,
      `${JSON.stringify({
        timestamp: entry.timestamp,
        level: entry.level,
        scopes: entry.scopes.map((scope) => serializeLoggerData(scope, seen)),
        data: serializeLoggerData(entry.data, seen),
      })}\n`,
    );
  }
}
