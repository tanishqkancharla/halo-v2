import type { AnySchema, ClientId, RemoteApi } from "@tanishqkancharla/tandem-core";
type PokeEvent = {
    type: "poke";
};
type PokeIterator = AsyncIterable<PokeEvent> & {
    return?: (value?: undefined) => Promise<IteratorResult<PokeEvent>>;
};
type OrpcSyncClient<Schema extends AnySchema> = {
    push: (args: Parameters<RemoteApi<Schema>["push"]>[0]) => Promise<Error | void>;
    pull: (args: Parameters<RemoteApi<Schema>["pull"]>[0]) => Promise<Error | Awaited<ReturnType<RemoteApi<Schema>["pull"]>>>;
    connect: (input: {
        clientId: ClientId;
    }, options?: {
        signal?: AbortSignal;
    }) => Promise<Error | PokeIterator>;
};
export declare function orpcSyncRemote<Schema extends AnySchema>(sync: OrpcSyncClient<Schema>): RemoteApi<Schema>;
export {};
