import path from "node:path";
import { Type } from "@sinclair/typebox";
import * as errore from "errore";
import { expect, test as baseTest } from "vitest";
import { createTestArtifacts } from "../test/TestArtifacts.js";
import {
  createDurableStream,
  type DurableStream,
  DurableStreamPersistenceError,
} from "./DurableStream.js";
import { FilesystemService } from "./filesystem/FilesystemService.js";
import {
  JsonlDurableStreamAppendError,
  JsonlDurableStreamStorage,
} from "./JsonlDurableStreamStorage.js";

const test = baseTest.extend<{ streamFile: string }>({
  streamFile: async ({ task }, use) => {
    const artifacts = await createTestArtifacts(task.id);
    await using cleanup = new errore.AsyncDisposableStack();
    cleanup.defer(() =>
      artifacts.finish({ passed: task.result?.state === "pass" }),
    );
    await use(path.join(artifacts.paths.workspace, "events.jsonl"));
  },
});

test("persists records before publishing them", async ({ streamFile }) => {
  const filesystem = new FilesystemService();
  const stream = await openStringStream(filesystem, streamFile);
  let contentsWhenPublished: Promise<string | Error> | undefined;
  const live = stream.consume({ afterSequence: 0 });
  const published = live.next();
  const unsubscribe = stream.subscribe((record) => {
    contentsWhenPublished = filesystem.readFile(streamFile, "utf8");
    expect(record).toEqual({ sequence: 1, value: "first" });
  });

  await expect(stream.append("first")).resolves.toEqual({
    sequence: 1,
    value: "first",
  });
  expect(await contentsWhenPublished).toContain(
    '{"sequence":1,"value":"first"}',
  );
  await expect(published).resolves.toEqual({
    done: false,
    value: { sequence: 1, value: "first" },
  });
  unsubscribe();
  await live.return();
});

test("serializes concurrent appends in sequence order", async ({
  streamFile,
}) => {
  const filesystem = new FilesystemService();
  const stream = await openStringStream(filesystem, streamFile);

  await expect(
    Promise.all([
      stream.append("one"),
      stream.append("two"),
      stream.append("three"),
    ]),
  ).resolves.toEqual([
    { sequence: 1, value: "one" },
    { sequence: 2, value: "two" },
    { sequence: 3, value: "three" },
  ]);
  expect(stream.snapshot()).toEqual([
    { sequence: 1, value: "one" },
    { sequence: 2, value: "two" },
    { sequence: 3, value: "three" },
  ]);

  const reopened = await openStringStream(filesystem, streamFile);
  expect(reopened.snapshot()).toEqual(stream.snapshot());
});

test("replays from a cursor and suppresses replay-live overlap", async ({
  streamFile,
}) => {
  const filesystem = new FilesystemService();
  const stream = await openStringStream(filesystem, streamFile);
  await stream.append("one");
  await stream.append("two");

  const values = stream.consume({ afterSequence: 0 });
  await expect(values.next()).resolves.toEqual({
    done: false,
    value: { sequence: 1, value: "one" },
  });
  await stream.append("three");
  await expect(values.next()).resolves.toEqual({
    done: false,
    value: { sequence: 2, value: "two" },
  });
  await expect(values.next()).resolves.toEqual({
    done: false,
    value: { sequence: 3, value: "three" },
  });
  await values.return();
});

test("stops durable consumption when aborted", async ({ streamFile }) => {
  const stream = await openStringStream(new FilesystemService(), streamFile);
  const abortController = new AbortController();
  const values = stream.consume({ abortSignal: abortController.signal });
  const finished = values.next();

  abortController.abort();
  await expect(finished).resolves.toEqual({ done: true, value: undefined });
});

test("wakes a parked consumer with the persistence error on append failure", async ({
  streamFile,
}) => {
  const filesystem = new FilesystemService();
  const stream = await openStringStream(filesystem, streamFile);
  const abortController = new AbortController();
  const values = stream.consume({
    afterSequence: 0,
    abortSignal: abortController.signal,
  });

  const first = values.next();
  await expect(stream.append("one")).resolves.toEqual({
    sequence: 1,
    value: "one",
  });
  await expect(first).resolves.toEqual({
    done: false,
    value: { sequence: 1, value: "one" },
  });

  const parked = values.next();

  const removed = await filesystem.remove(path.dirname(streamFile), {
    recursive: true,
    force: true,
  });
  if (removed instanceof Error) throw removed;

  const appended = await stream.append("two");
  expect(appended).toBeInstanceOf(DurableStreamPersistenceError);
  // SAFETY: the preceding expect confirmed appended is a DurableStreamPersistenceError.
  expect((appended as DurableStreamPersistenceError).cause).toBeInstanceOf(
    JsonlDurableStreamAppendError,
  );

  await expect(parked).rejects.toBeInstanceOf(DurableStreamPersistenceError);
  await values.return();
});

test("a consumer opened after failure replays history then throws the error", async ({
  streamFile,
}) => {
  const filesystem = new FilesystemService();
  const stream = await openStringStream(filesystem, streamFile);
  await expect(stream.append("one")).resolves.toEqual({
    sequence: 1,
    value: "one",
  });

  const removed = await filesystem.remove(path.dirname(streamFile), {
    recursive: true,
    force: true,
  });
  if (removed instanceof Error) throw removed;
  await expect(stream.append("two")).resolves.toBeInstanceOf(
    DurableStreamPersistenceError,
  );

  const values = stream.consume({ afterSequence: 0 });
  await expect(values.next()).resolves.toEqual({
    done: false,
    value: { sequence: 1, value: "one" },
  });
  await expect(values.next()).rejects.toBeInstanceOf(
    DurableStreamPersistenceError,
  );
  await values.return();
});

test("wakes every parked consumer when an append fails", async ({
  streamFile,
}) => {
  const filesystem = new FilesystemService();
  const stream = await openStringStream(filesystem, streamFile);
  const abortController = new AbortController();
  const readerA = stream.consume({
    afterSequence: 0,
    abortSignal: abortController.signal,
  });
  const readerB = stream.consume({
    afterSequence: 0,
    abortSignal: abortController.signal,
  });

  const firstA = readerA.next();
  const firstB = readerB.next();
  await expect(stream.append("one")).resolves.toEqual({
    sequence: 1,
    value: "one",
  });
  await expect(firstA).resolves.toEqual({
    done: false,
    value: { sequence: 1, value: "one" },
  });
  await expect(firstB).resolves.toEqual({
    done: false,
    value: { sequence: 1, value: "one" },
  });

  const parkedA = readerA.next();
  const parkedB = readerB.next();

  const removed = await filesystem.remove(path.dirname(streamFile), {
    recursive: true,
    force: true,
  });
  if (removed instanceof Error) throw removed;
  await expect(stream.append("two")).resolves.toBeInstanceOf(
    DurableStreamPersistenceError,
  );

  await expect(parkedA).rejects.toBeInstanceOf(DurableStreamPersistenceError);
  await expect(parkedB).rejects.toBeInstanceOf(DurableStreamPersistenceError);
  await readerA.return();
  await readerB.return();
});

test("rejects malformed JSONL history", async ({ streamFile }) => {
  const filesystem = new FilesystemService();
  const written = await filesystem.writeFile(streamFile, "not-json\n");
  if (written instanceof Error) throw written;

  const stream = await createDurableStream({
    storage: stringStorage(filesystem, streamFile),
  });
  expect(stream).toBeInstanceOf(DurableStreamPersistenceError);
});

async function openStringStream(
  filesystem: FilesystemService,
  streamFile: string,
): Promise<DurableStream<string>> {
  const stream = await createDurableStream({
    storage: stringStorage(filesystem, streamFile),
  });
  if (stream instanceof Error) throw stream;
  return stream;
}

function stringStorage(filesystem: FilesystemService, streamFile: string) {
  return new JsonlDurableStreamStorage({
    filesystem,
    path: streamFile,
    valueSchema: Type.String(),
  });
}
