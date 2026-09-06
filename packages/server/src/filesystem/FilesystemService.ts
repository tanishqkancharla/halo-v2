import fs from "node:fs";
import fsPromises from "node:fs/promises";
import * as watcher from "@parcel/watcher";
import * as errore from "errore";
import { type ReadonlyStream, Stream } from "../Stream.js";

export type FilesystemWatchEvent =
  | {
      type: "create";
      path: string;
      kind: "file" | "directory";
    }
  | {
      type: "update";
      path: string;
    }
  | {
      type: "delete";
      path: string;
    };

export type FilesystemWatchBatch = {
  watchedPath: string;
  events: readonly FilesystemWatchEvent[];
};

export class FilesystemWatchError extends errore.createTaggedError({
  name: "FilesystemWatchError",
  message: "Filesystem watch failed for '$watchedPath'",
}) {}

export class FilesystemOperationError extends errore.createTaggedError({
  name: "FilesystemOperationError",
  message: "Filesystem $operation failed for '$path'",
}) {}

export class FilesystemPathNotFoundError extends errore.createTaggedError({
  name: "FilesystemPathNotFoundError",
  message: "Filesystem path '$path' does not exist",
}) {}

export type FilesystemError =
  | FilesystemOperationError
  | FilesystemPathNotFoundError;

const parcelWatcherIgnore = [
  "**/node_modules/**",
  "**/.*",
  "**/.*/**",
] as const;

export class FilesystemService {
  private readonly watchEventStream = new Stream<
    FilesystemWatchBatch | FilesystemWatchError
  >();
  readonly watchEvents: ReadonlyStream<
    FilesystemWatchBatch | FilesystemWatchError
  > = this.watchEventStream;
  private watchState:
    | { path: string; subscription: watcher.AsyncSubscription }
    | undefined;
  // Serialized enrichment so watch batches append in dispatch order. @parcel/watcher invokes the
  // subscribe callback via a ThreadSafeFunction and discards its return value, so an async callback
  // yields immediately while the native side enqueues the next batch; chaining here keeps each
  // batch's enrichment + append behind the previous one regardless of stat latency.
  private watchQueue: Promise<void> = Promise.resolve();

  exists(path: string) {
    return fs.existsSync(path);
  }

  loadEnvironmentFile(path: string) {
    return errore.try({
      try: () => process.loadEnvFile(path),
      catch: (cause) =>
        filesystemError({ operation: "load environment", path, cause }),
    });
  }

  readFile(path: string): Promise<Buffer | FilesystemError>;
  readFile(
    path: string,
    encoding: BufferEncoding,
  ): Promise<string | FilesystemError>;
  async readFile(
    path: string,
    encoding?: BufferEncoding,
  ): Promise<Buffer | string | FilesystemError> {
    if (encoding === undefined) {
      return await fsPromises
        .readFile(path)
        .catch((cause) => filesystemError({ operation: "read", path, cause }));
    }
    return await fsPromises
      .readFile(path, encoding)
      .catch((cause) => filesystemError({ operation: "read", path, cause }));
  }

  async writeFile(
    path: string,
    data: string | Uint8Array,
    options?: BufferEncoding | { mode?: number },
  ) {
    return await fsPromises
      .writeFile(path, data, options)
      .catch((cause) => filesystemError({ operation: "write", path, cause }));
  }

  async appendFile(
    path: string,
    data: string | Uint8Array,
    options?: BufferEncoding | { mode?: number },
  ) {
    return await fsPromises
      .appendFile(path, data, options)
      .catch((cause) => filesystemError({ operation: "append", path, cause }));
  }

  async makeDirectory(
    path: string,
    options?: { recursive?: boolean; mode?: number },
  ) {
    const created = await fsPromises
      .mkdir(path, options)
      .catch((cause) =>
        filesystemError({ operation: "create directory", path, cause }),
      );
    if (created instanceof Error) return created;
  }

  async listDirectory(path: string) {
    return await fsPromises
      .readdir(path, { withFileTypes: true })
      .catch((cause) => filesystemError({ operation: "list", path, cause }));
  }

  async realpath(path: string) {
    return await fsPromises
      .realpath(path)
      .catch((cause) => filesystemError({ operation: "resolve", path, cause }));
  }

  async stat(path: string) {
    return await fsPromises
      .stat(path)
      .catch((cause) => filesystemError({ operation: "stat", path, cause }));
  }

  async remove(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ) {
    return await fsPromises
      .rm(path, options)
      .catch((cause) => filesystemError({ operation: "remove", path, cause }));
  }

  async unlink(path: string) {
    return await fsPromises
      .unlink(path)
      .catch((cause) => filesystemError({ operation: "unlink", path, cause }));
  }

  async chmod(path: string, mode: number) {
    return await fsPromises
      .chmod(path, mode)
      .catch((cause) => filesystemError({ operation: "chmod", path, cause }));
  }

  readFileSync(path: string, encoding: BufferEncoding) {
    return errore.try({
      try: () => fs.readFileSync(path, encoding),
      catch: (cause) => filesystemError({ operation: "read", path, cause }),
    });
  }

  writeFileSync(path: string, data: string) {
    return errore.try({
      try: () => fs.writeFileSync(path, data),
      catch: (cause) => filesystemError({ operation: "write", path, cause }),
    });
  }

  makeDirectorySync(path: string) {
    return errore.try({
      try: () => fs.mkdirSync(path, { recursive: true }),
      catch: (cause) =>
        filesystemError({ operation: "create directory", path, cause }),
    });
  }

  unlinkSync(path: string) {
    return errore.try({
      try: () => fs.unlinkSync(path),
      catch: (cause) => filesystemError({ operation: "unlink", path, cause }),
    });
  }

  async watch(path: string) {
    const stopped = await this.stopWatch();
    if (stopped instanceof Error) return stopped;

    const subscription = await watcher
      .subscribe(
        path,
        (error, events) => {
          const run = async () => {
            if (error !== null) {
              this.watchEventStream.append(
                new FilesystemWatchError({ watchedPath: path, cause: error }),
              );
              return;
            }
            await this.emitWatchEvents(path, events);
          };
          this.watchQueue = this.watchQueue.then(run).catch((cause) => {
            console.error("Watch event processing failed:", cause);
          });
        },
        { ignore: [...parcelWatcherIgnore] },
      )
      .catch((cause) => new FilesystemWatchError({ watchedPath: path, cause }));
    if (subscription instanceof Error) return subscription;
    this.watchState = { path, subscription };
  }

  async close() {
    return await this.stopWatch();
  }

  private async stopWatch() {
    const state = this.watchState;
    this.watchState = undefined;
    if (state === undefined) return;
    const drained = this.watchQueue;
    const unsubscribed = await state.subscription.unsubscribe().catch(
      (cause) =>
        new FilesystemWatchError({
          watchedPath: state.path,
          cause,
        }),
    );
    await drained;
    return unsubscribed;
  }

  private async emitWatchEvents(
    watchedPath: string,
    events: readonly watcher.Event[],
  ) {
    const enriched: FilesystemWatchEvent[] = [];
    for (const event of events) {
      if (event.type !== "create") {
        enriched.push({ type: event.type, path: event.path });
        continue;
      }
      const metadata = await this.stat(event.path);
      if (metadata instanceof Error) {
        console.warn("Could not inspect created filesystem entry:", metadata);
        continue;
      }
      if (metadata.isDirectory()) {
        enriched.push({ ...event, kind: "directory" });
        continue;
      }
      if (metadata.isFile()) enriched.push({ ...event, kind: "file" });
    }
    if (enriched.length === 0) return;
    this.watchEventStream.append({ watchedPath, events: enriched });
  }
}

function filesystemError(args: {
  operation: string;
  path: string;
  cause: unknown;
}) {
  if (
    args.cause instanceof Error &&
    "code" in args.cause &&
    args.cause.code === "ENOENT"
  ) {
    return new FilesystemPathNotFoundError({
      path: args.path,
      cause: args.cause,
    });
  }
  return new FilesystemOperationError(args);
}
