import type {
  AnySchema,
  ClientId,
  RemoteApi,
} from "@tanishqkancharla/tandem-core";
import * as errore from "errore";

type PokeEvent = { type: "poke" };

type PokeIterator = AsyncIterable<PokeEvent>;

class SyncRemoteConnectionError extends errore.createTaggedError({
  name: "SyncRemoteConnectionError",
  message: "Plugin sync connection failed",
}) {}

type OrpcSyncClient<Schema extends AnySchema> = {
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
      const consumed = consumePokes(iterator, poke).catch((cause) =>
        controller.signal.aborted
          ? undefined
          : new SyncRemoteConnectionError({ cause }),
      );
      return async () => {
        controller.abort();
        const result = await consumed;
        if (result instanceof Error) throw result;
      };
    },
  };
}

async function consumePokes(iterator: PokeIterator, poke: () => void) {
  for await (const event of iterator) {
    if (event.type === "poke") poke();
  }
}
