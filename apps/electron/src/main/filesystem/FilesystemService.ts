import * as watcher from "@parcel/watcher";
import * as errore from "errore";
import { type ReadonlyStream, Stream } from "../../shared/Stream.js";

export type FilesystemWatchEvent = {
  type: "create" | "update" | "delete";
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
          this.watchEventStream.append({ watchedPath: path, events });
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
}
