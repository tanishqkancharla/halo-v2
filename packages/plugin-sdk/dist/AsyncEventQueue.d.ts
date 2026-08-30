export declare class AsyncEventQueue<T> {
    private readonly pending;
    private waiting;
    private closed;
    push(value: T): Promise<void>;
    close(): void;
    values(signal: AbortSignal | undefined): AsyncGenerator<Awaited<T>, void, unknown>;
    private take;
}
