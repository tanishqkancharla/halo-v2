/* oxlint-disable anti-slop/no-unused-exports -- Shared primitive awaiting its first consumer. */

export type StreamSubscriber<T> = (value: T) => void;

export type ReadonlyStream<T> = {
  subscribe(subscriber: StreamSubscriber<T>): () => void;
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

  map<V>(transform: (value: U) => V): ReadonlyStream<V> {
    return new MappedStream(this, transform);
  }

  filter<V extends U>(predicate: (value: U) => value is V): ReadonlyStream<V>;
  filter(predicate: (value: U) => boolean): ReadonlyStream<U>;
  filter(predicate: (value: U) => boolean): ReadonlyStream<U> {
    return new FilteredStream(this, predicate);
  }
}
