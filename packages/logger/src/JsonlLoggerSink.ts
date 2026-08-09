import { appendFileSync } from "node:fs";
import type { LoggerEntry, LoggerSinkApi } from "./Logger.js";

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
