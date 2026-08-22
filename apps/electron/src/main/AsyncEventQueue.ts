type QueueItem<T> = {
  value: T;
  delivered: () => void;
};

export class AsyncEventQueue<T> {
  private readonly pending: QueueItem<T>[] = [];
  private waiting: ((item: QueueItem<T> | undefined) => void) | undefined;
  private closed = false;

  push(value: T): Promise<void> {
    if (this.closed) return Promise.resolve();
    return new Promise((delivered) => {
      const item = { value, delivered };
      if (this.waiting !== undefined) {
        const waiting = this.waiting;
        this.waiting = undefined;
        waiting(item);
        return;
      }
      this.pending.push(item);
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const item of this.pending) {
      item.delivered();
    }
    this.pending.length = 0;
    if (this.waiting !== undefined) {
      const waiting = this.waiting;
      this.waiting = undefined;
      waiting(undefined);
    }
  }

  async *values(signal: AbortSignal | undefined) {
    try {
      while (true) {
        const item = await this.take(signal);
        if (item === undefined) return;
        yield item.value;
        item.delivered();
      }
    } finally {
      this.close();
    }
  }

  private take(
    signal: AbortSignal | undefined,
  ): Promise<QueueItem<T> | undefined> {
    if (signal !== undefined && signal.aborted) {
      return Promise.resolve(undefined);
    }
    const first = this.pending.shift();
    if (first !== undefined) return Promise.resolve(first);
    if (this.closed) return Promise.resolve(undefined);

    return new Promise((resolve) => {
      const state = { settled: false };
      const settle = (item: QueueItem<T> | undefined) => {
        if (state.settled) return;
        state.settled = true;
        if (signal !== undefined) {
          signal.removeEventListener("abort", onAbort);
        }
        resolve(item);
      };
      const onAbort = () => {
        this.waiting = undefined;
        settle(undefined);
      };
      this.waiting = settle;
      if (signal !== undefined) {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }
}
