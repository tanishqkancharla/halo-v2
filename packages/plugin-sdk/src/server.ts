import { os, type } from "@orpc/server";
import { RemoteServer } from "@tandem/server";
import type { RuntimeSchemaDefinition } from "@tandem/core";
import type { AnySchema, ClientId, RemoteApi } from "@tandem/types";
import { AsyncEventQueue } from "./AsyncEventQueue.js";
import { FileRemoteStore, PluginStorageStoreError } from "./FileRemoteStore.js";

export type PluginServerContext = {
  pluginId: string;
  workspaceRoot: string;
};

export const pluginOs = os.$context<PluginServerContext>();

export { os, type, PluginStorageStoreError };

let bound!: PluginServerContext;

export function bindPluginServerContext(context: PluginServerContext) {
  bound = context;
}

export function syncRoutes<Schema extends AnySchema>(
  tables: RuntimeSchemaDefinition<Schema>,
) {
  const store = FileRemoteStore.open({
    pluginId: bound.pluginId,
    workspaceRoot: bound.workspaceRoot,
    collections: Object.keys(tables.collections),
  });
  if (store instanceof Error) throw store;
  const remote = new RemoteServer({ store });

  return {
    sync: {
      push: pluginOs
        .input(type<Parameters<RemoteApi<AnySchema>["push"]>[0]>())
        .handler(({ input, context }) =>
          remote.push(input).catch(
            (e) =>
              new PluginStorageStoreError({
                pluginId: context.pluginId,
                cause: e,
              }),
          ),
        ),
      pull: pluginOs
        .input(type<Parameters<RemoteApi<AnySchema>["pull"]>[0]>())
        .handler(({ input, context }) =>
          remote.pull(input).catch(
            (e) =>
              new PluginStorageStoreError({
                pluginId: context.pluginId,
                cause: e,
              }),
          ),
        ),
      connect: pluginOs
        .input(type<{ clientId: ClientId }>())
        .handler(async ({ input, context, signal }) => {
          const queue = new AsyncEventQueue<{ type: "poke" }>();
          const unsubscribe = await remote
            .connect({
              clientId: input.clientId,
              poke: () => {
                void queue.push({ type: "poke" });
              },
            })
            .catch(
              (e) =>
                new PluginStorageStoreError({
                  pluginId: context.pluginId,
                  cause: e,
                }),
            );
          if (unsubscribe instanceof Error) return unsubscribe;
          return (async function* () {
            try {
              yield* queue.values(signal);
            } finally {
              await unsubscribe();
            }
          })();
        }),
    },
  };
}
