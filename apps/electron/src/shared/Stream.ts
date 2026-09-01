/* oxlint-disable anti-slop/no-unused-exports -- Shared primitive awaiting its first consumer. */

export type StreamSubscriber<T> = (value: T) => void;

export type ReadonlyStream<T> = {
  subscribe(subscriber: StreamSubscriber<T>): () => void;
  map<U>(transform: (value: T) => U): ReadonlyStream<U>;
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
}
