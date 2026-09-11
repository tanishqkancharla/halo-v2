export class SerialQueue {
  // Tracks the last enqueued operation so the next waits for it to settle.
  private pending: Promise<unknown> = Promise.resolve();

  run<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.pending.then(
      () => operation(),
      () => operation(),
    );
    this.pending = result;
    return result;
  }
}
