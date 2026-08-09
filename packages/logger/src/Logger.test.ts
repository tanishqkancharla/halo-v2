import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { JsonlLoggerSink } from "./JsonlLoggerSink.js";
import { Logger, type LoggerEntry, type LoggerSinkApi } from "./Logger.js";

class CollectingSink implements LoggerSinkApi {
  readonly entries: LoggerEntry[] = [];

  log(entry: LoggerEntry) {
    this.entries.push(entry);
  }
}

describe("Logger", () => {
  test("writes level, timestamp, scopes, and data to sinks", () => {
    const sink = new CollectingSink();
    const logger = new Logger({ sinks: [sink] });

    logger.info({ message: "hello", count: 1 });

    expect(sink.entries).toHaveLength(1);
    const entry = sink.entries[0]!;
    expect(entry.level).toBe("info");
    expect(entry.scopes).toEqual([]);
    expect(entry.data).toEqual({ message: "hello", count: 1 });
    expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
  });

  test("appends each scope as its own object in order", () => {
    const sink = new CollectingSink();
    const logger = new Logger({ sinks: [sink] })
      .scope("renderer")
      .scope("ui", { route: "chat" });

    logger.warn({ message: "slow render" });

    expect(sink.entries[0]!.scopes).toEqual([
      { renderer: {} },
      { ui: { route: "chat" } },
    ]);
    expect(sink.entries[0]!.data).toEqual({
      message: "slow render",
    });
  });

  test("addSink shares existing scopes with the new sink", () => {
    const first = new CollectingSink();
    const second = new CollectingSink();
    const logger = new Logger({ sinks: [first] }).scope("main").addSink(second);

    logger.log({ event: "ready" });

    expect(first.entries[0]!.scopes).toEqual([{ main: {} }]);
    expect(first.entries[0]!.data).toEqual({ event: "ready" });
    expect(second.entries[0]!.scopes).toEqual([{ main: {} }]);
    expect(second.entries[0]!.data).toEqual({ event: "ready" });
  });

  test("destroy calls each unique sink once", () => {
    const destroyed: string[] = [];
    const sink: LoggerSinkApi = {
      log() {},
      destroy() {
        destroyed.push("sink");
      },
    };
    const logger = new Logger({ sinks: [sink, sink] });

    logger.destroy();

    expect(destroyed).toEqual(["sink"]);
  });
});

describe("JsonlLoggerSink", () => {
  test("appends serialized entries as json lines", async () => {
    const directory = await mkdtemp(join(tmpdir(), "halo-logger-"));
    const filePath = join(directory, "test.jsonl");
    const sink = new JsonlLoggerSink({ filePath });
    const logger = new Logger({ sinks: [sink] }).scope("main");
    const error = new Error("boom");

    logger.error({ message: "failed", error });

    const lines = (await readFile(filePath, "utf8")).trimEnd().split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as LoggerEntry;
    expect(parsed.level).toBe("error");
    expect(parsed.scopes).toEqual([{ main: {} }]);
    expect(parsed.data).toEqual({
      message: "failed",
      error: {
        name: "Error",
        message: "boom",
        stack: error.stack,
      },
    });

    await rm(directory, { recursive: true, force: true });
  });
});
