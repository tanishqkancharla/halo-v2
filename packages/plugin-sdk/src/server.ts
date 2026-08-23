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

export function syncRoutes<Schema extends AnySchema>(
  tables: RuntimeSchemaDefinition<Schema>,
) {
  const collections = Object.keys(tables.collections);
  let remote: RemoteServer | undefined;

  return {
    sync: {
      push: pluginOs
        .input(type<Parameters<RemoteApi<AnySchema>["push"]>[0]>())
        .handler(async ({ input, context }) => {
          if (remote === undefined) {
            const store = await FileRemoteStore.open({
              pluginId: context.pluginId,
              workspaceRoot: context.workspaceRoot,
              collections,
            });
            if (store instanceof Error) return store;
            remote = new RemoteServer({ store });
          }
          return remote.push(input).catch(
            (e) =>
              new PluginStorageStoreError({
                pluginId: context.pluginId,
                cause: e,
              }),
          );
        }),
      pull: pluginOs
        .input(type<Parameters<RemoteApi<AnySchema>["pull"]>[0]>())
        .handler(async ({ input, context }) => {
          if (remote === undefined) {
            const store = await FileRemoteStore.open({
              pluginId: context.pluginId,
              workspaceRoot: context.workspaceRoot,
              collections,
            });
            if (store instanceof Error) return store;
            remote = new RemoteServer({ store });
          }
          return remote.pull(input).catch(
            (e) =>
              new PluginStorageStoreError({
                pluginId: context.pluginId,
                cause: e,
              }),
          );
        }),
      connect: pluginOs
        .input(type<{ clientId: ClientId }>())
        .handler(async ({ input, context, signal }) => {
          if (remote === undefined) {
            const store = await FileRemoteStore.open({
              pluginId: context.pluginId,
              workspaceRoot: context.workspaceRoot,
              collections,
            });
            if (store instanceof Error) return store;
            remote = new RemoteServer({ store });
          }
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
