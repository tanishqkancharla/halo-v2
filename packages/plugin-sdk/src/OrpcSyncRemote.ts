import type { AnySchema, ClientId, RemoteApi } from "@tandem/types";

type PokeIterator = AsyncIterable<{ type: "poke" }> & {
  return?: (value?: undefined) => Promise<unknown>;
};

export type OrpcSyncClient<Schema extends AnySchema> = {
  push: (
    args: Parameters<RemoteApi<Schema>["push"]>[0],
  ) => Promise<Error | void>;
  pull: (
    args: Parameters<RemoteApi<Schema>["pull"]>[0],
  ) => Promise<Error | Awaited<ReturnType<RemoteApi<Schema>["pull"]>>>;
  connect: (
    input: { clientId: ClientId },
    options?: { signal?: AbortSignal },
  ) => Promise<Error | PokeIterator>;
};

export function orpcSyncRemote<Schema extends AnySchema>(
  sync: OrpcSyncClient<Schema>,
): RemoteApi<Schema> {
  return {
    push: async (args) => {
      const result = await sync.push(args);
      if (result instanceof Error) throw result;
    },
    pull: async (args) => {
      const result = await sync.pull(args);
      if (result instanceof Error) throw result;
      return result;
    },
    connect: async ({ clientId, poke }) => {
      const controller = new AbortController();
      const iterator = await sync.connect(
        { clientId },
        { signal: controller.signal },
      );
      if (iterator instanceof Error) throw iterator;
      void (async () => {
        for await (const event of iterator) {
          if (event.type === "poke") poke();
        }
      })();
      return async () => {
        controller.abort();
        void iterator.return?.(undefined);
      };
    },
  };
}
