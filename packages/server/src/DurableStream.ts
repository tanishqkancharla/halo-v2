import * as errore from "errore";
import { Stream, type StreamConsumeOptions } from "./Stream.js";

export type DurableStreamRecord<T> = {
  sequence: number;
  value: T;
};

type DurableStreamConsumeOptions = StreamConsumeOptions & {
  afterSequence?: number;
};

export type DurableStreamStorage<T> = {
  load(): Promise<readonly DurableStreamRecord<T>[] | Error>;
  append(records: readonly DurableStreamRecord<T>[]): Promise<void | Error>;
};

export class DurableStreamPersistenceError extends errore.createTaggedError({
  name: "DurableStreamPersistenceError",
  message: "Durable stream $operation failed",
}) {}

export class DurableStreamHistoryError extends errore.createTaggedError({
  name: "DurableStreamHistoryError",
  message: "Durable stream history is not contiguous at sequence $sequence",
}) {}

type PendingAppend<T> = {
  record: DurableStreamRecord<T>;
  resolve: (
    result: DurableStreamRecord<T> | DurableStreamPersistenceError,
  ) => void;
};

export async function createDurableStream<T>(args: {
  storage: DurableStreamStorage<T>;
}): Promise<DurableStream<T> | Error> {
  const records = await args.storage.load();
  if (records instanceof Error) {
    return new DurableStreamPersistenceError({
      operation: "load",
      cause: records,
    });
  }
  for (const [index, record] of records.entries()) {
    const expectedSequence = index + 1;
    if (record.sequence === expectedSequence) continue;
    return new DurableStreamHistoryError({
      sequence: expectedSequence,
    });
  }
  return new DurableStream({ storage: args.storage, records });
}

export class DurableStream<T> {
  private readonly liveStream = new Stream<DurableStreamRecord<T>>();
  private readonly records: DurableStreamRecord<T>[];
  private readonly pendingAppends: PendingAppend<T>[] = [];
  private nextSequence: number;
  private flushing = false;
  private failure: DurableStreamPersistenceError | undefined;

  constructor(args: {
    storage: DurableStreamStorage<T>;
    records: readonly DurableStreamRecord<T>[];
  }) {
    this.storage = args.storage;
    this.records = [...args.records];
    this.nextSequence = this.records.length + 1;
  }

  private readonly storage: DurableStreamStorage<T>;

  snapshot(): readonly DurableStreamRecord<T>[] {
    return [...this.records];
  }

  subscribe(subscriber: (record: DurableStreamRecord<T>) => void): () => void {
    return this.liveStream.subscribe(subscriber);
  }

  append(
    value: T,
  ): Promise<DurableStreamRecord<T> | DurableStreamPersistenceError> {
    if (this.failure !== undefined) return Promise.resolve(this.failure);

    const record = { sequence: this.nextSequence, value };
    this.nextSequence += 1;
    const result = new Promise<
      DurableStreamRecord<T> | DurableStreamPersistenceError
    >((resolve) => {
      this.pendingAppends.push({ record, resolve });
    });
    if (!this.flushing) {
      this.flushing = true;
      queueMicrotask(() => void this.flush());
    }
    return result;
  }

  async *consume(
    options?: DurableStreamConsumeOptions,
  ): AsyncGenerator<DurableStreamRecord<T>, void, void> {
    const values: DurableStreamRecord<T>[] = [];
    let wake: (() => void) | undefined;
    const abortSignal = options?.abortSignal;
    let aborted = abortSignal?.aborted === true;
    let cursor = options?.afterSequence;
    if (cursor === undefined) cursor = 0;

    const wakeConsumer = () => {
      const current = wake;
      wake = undefined;
      current?.();
    };
    using cleanup = new errore.DisposableStack();
    cleanup.defer(
      this.liveStream.subscribe((record) => {
        values.push(record);
        wakeConsumer();
      }),
    );
    const replay = this.snapshot();
    const abort = () => {
      aborted = true;
      wakeConsumer();
    };
    abortSignal?.addEventListener("abort", abort, { once: true });
    cleanup.defer(() => abortSignal?.removeEventListener("abort", abort));

    for (const record of replay) {
      if (aborted) return;
      if (record.sequence <= cursor) continue;
      cursor = record.sequence;
      yield record;
    }

    while (true) {
      if (aborted) return;
      if (values.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
      const ready = values.splice(0);
      for (const record of ready) {
        if (aborted) return;
        if (record.sequence <= cursor) continue;
        cursor = record.sequence;
        yield record;
      }
    }
  }

  private async flush(): Promise<void> {
    while (this.pendingAppends.length > 0) {
      const batch = this.pendingAppends.splice(0);
      const records = batch.map((pending) => pending.record);
      const appended = await this.storage.append(records);
      if (appended instanceof Error) {
        const failure = new DurableStreamPersistenceError({
          operation: "append",
          cause: appended,
        });
        this.failure = failure;
        for (const pending of [...batch, ...this.pendingAppends.splice(0)]) {
          pending.resolve(failure);
        }
        this.flushing = false;
        return;
      }
      for (const pending of batch) {
        this.records.push(pending.record);
        this.liveStream.append(pending.record);
        pending.resolve(pending.record);
      }
    }
    this.flushing = false;
  }
}
