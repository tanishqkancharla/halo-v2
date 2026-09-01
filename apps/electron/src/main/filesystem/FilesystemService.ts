import fs from "node:fs";
import fsPromises from "node:fs/promises";
import * as watcher from "@parcel/watcher";
import * as errore from "errore";
import { type ReadonlyStream, Stream } from "../../shared/Stream.js";

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

  exists(path: string) {
    return fs.existsSync(path);
  }

  async readTextFile(path: string) {
    return fsPromises
      .readFile(path, "utf8")
      .catch(
        (cause) =>
          new FilesystemOperationError({ operation: "read", path, cause }),
      );
  }

  async writeFile(
    path: string,
    data: string | Uint8Array,
    options?: BufferEncoding | { mode?: number },
  ) {
    return fsPromises
      .writeFile(path, data, options)
      .then(() => undefined)
      .catch(
        (cause) =>
          new FilesystemOperationError({ operation: "write", path, cause }),
      );
  }

  async makeDirectory(
    path: string,
    options?: { recursive?: boolean; mode?: number },
  ) {
    return fsPromises
      .mkdir(path, options)
      .then(() => undefined)
      .catch(
        (cause) =>
          new FilesystemOperationError({
            operation: "create directory",
            path,
            cause,
          }),
      );
  }

  async listDirectory(path: string) {
    return fsPromises
      .readdir(path, { withFileTypes: true })
      .catch(
        (cause) =>
          new FilesystemOperationError({ operation: "list", path, cause }),
      );
  }

  async realpath(path: string) {
    return fsPromises
      .realpath(path)
      .catch(
        (cause) =>
          new FilesystemOperationError({ operation: "resolve", path, cause }),
      );
  }

  async stat(path: string) {
    return fsPromises
      .stat(path)
      .catch(
        (cause) =>
          new FilesystemOperationError({ operation: "stat", path, cause }),
      );
  }

  async remove(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ) {
    return fsPromises
      .rm(path, options)
      .then(() => undefined)
      .catch(
        (cause) =>
          new FilesystemOperationError({ operation: "remove", path, cause }),
      );
  }

  async chmod(path: string, mode: number) {
    return fsPromises
      .chmod(path, mode)
      .then(() => undefined)
      .catch(
        (cause) =>
          new FilesystemOperationError({ operation: "chmod", path, cause }),
      );
  }

  async watch(path: string) {
    const stopped = await this.stopWatch();
    if (stopped instanceof Error) return stopped;

    const subscription = await watcher
      .subscribe(
        path,
        (error, events) => {
          if (error !== null) {
            this.watchEventStream.append(
              new FilesystemWatchError({ watchedPath: path, cause: error }),
            );
            return;
          }
          void this.emitWatchEvents(path, events);
        },
        { ignore: [...parcelWatcherIgnore] },
      )
      .catch((cause) => new FilesystemWatchError({ watchedPath: path, cause }));
    if (subscription instanceof Error) return subscription;
    this.watchState = { path, subscription };
  }

  close() {
    return this.stopWatch();
  }

  private async stopWatch() {
    const state = this.watchState;
    this.watchState = undefined;
    if (state === undefined) return;
    return state.subscription
      .unsubscribe()
      .then(() => undefined)
      .catch(
        (cause) =>
          new FilesystemWatchError({
            watchedPath: state.path,
            cause,
          }),
      );
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
