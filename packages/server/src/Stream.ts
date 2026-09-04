import * as errore from "errore";

type StreamSubscriber<T> = (value: T) => void;

export type StreamConsumeOptions = {
  abortSignal?: AbortSignal;
};

export type ReadonlyStream<T> = {
  subscribe(subscriber: StreamSubscriber<T>): () => void;
  consume(options?: StreamConsumeOptions): AsyncGenerator<T, void, void>;
  map<U>(transform: (value: T) => U): ReadonlyStream<U>;
  filter<S extends T>(predicate: (value: T) => value is S): ReadonlyStream<S>;
  filter(predicate: (value: T) => boolean): ReadonlyStream<T>;
};

export class Stream<T> implements ReadonlyStream<T> {
  private readonly subscribers = new Set<StreamSubscriber<T>>();

  append(value: T): void {
    for (const subscriber of this.subscribers) {
      subscriber(value);
    }
  }

  subscribe(subscriber: StreamSubscriber<T>): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  consume(options?: StreamConsumeOptions): AsyncGenerator<T, void, void> {
    return consumeStream(this, options);
  }

  map<U>(transform: (value: T) => U): ReadonlyStream<U> {
    return new MappedStream(this, transform);
  }

  filter<S extends T>(predicate: (value: T) => value is S): ReadonlyStream<S>;
  filter(predicate: (value: T) => boolean): ReadonlyStream<T>;
  filter(predicate: (value: T) => boolean): ReadonlyStream<T> {
    return new FilteredStream(this, predicate);
  }
}

class MappedStream<T, U> implements ReadonlyStream<U> {
  constructor(
    private readonly source: ReadonlyStream<T>,
    private readonly transform: (value: T) => U,
  ) {}

  subscribe(subscriber: StreamSubscriber<U>): () => void {
    return this.source.subscribe((value) => subscriber(this.transform(value)));
  }

  consume(options?: StreamConsumeOptions): AsyncGenerator<U, void, void> {
    return consumeStream(this, options);
  }

  map<V>(transform: (value: U) => V): ReadonlyStream<V> {
    return new MappedStream(this, transform);
  }

  filter<V extends U>(predicate: (value: U) => value is V): ReadonlyStream<V>;
  filter(predicate: (value: U) => boolean): ReadonlyStream<U>;
  filter(predicate: (value: U) => boolean): ReadonlyStream<U> {
    return new FilteredStream(this, predicate);
  }
}

class FilteredStream<T, U extends T = T> implements ReadonlyStream<U> {
  constructor(
    private readonly source: ReadonlyStream<T>,
    private readonly predicate: (value: T) => boolean,
  ) {}

  subscribe(subscriber: StreamSubscriber<U>): () => void {
    return this.source.subscribe((value) => {
      if (!this.predicate(value)) return;
      // SAFETY: U is the type selected by the predicate that accepted value.
      subscriber(value as U);
    });
  }

  consume(options?: StreamConsumeOptions): AsyncGenerator<U, void, void> {
    return consumeStream(this, options);
  }

  map<V>(transform: (value: U) => V): ReadonlyStream<V> {
    return new MappedStream(this, transform);
  }

  filter<V extends U>(predicate: (value: U) => value is V): ReadonlyStream<V>;
  filter(predicate: (value: U) => boolean): ReadonlyStream<U>;
  filter(predicate: (value: U) => boolean): ReadonlyStream<U> {
    return new FilteredStream(this, predicate);
  }
}

async function* consumeStream<T>(
  stream: ReadonlyStream<T>,
  options?: StreamConsumeOptions,
): AsyncGenerator<T, void, void> {
  const signal = options?.abortSignal;
  const values: T[] = [];
  let wake: (() => void) | undefined;
  let aborted = signal?.aborted === true;
  const wakeConsumer = () => {
    const current = wake;
    wake = undefined;
    current?.();
  };
  const unsubscribe = stream.subscribe((value) => {
    values.push(value);
    wakeConsumer();
  });
  using cleanup = new errore.DisposableStack();
  cleanup.defer(unsubscribe);
  const abort = () => {
    aborted = true;
    wakeConsumer();
  };
  signal?.addEventListener("abort", abort, { once: true });
  cleanup.defer(() => signal?.removeEventListener("abort", abort));

  while (true) {
    if (aborted) return;
    if (values.length === 0) {
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
    const ready = values.splice(0);
    for (const value of ready) {
      if (aborted) return;
      yield value;
    }
  }
}
