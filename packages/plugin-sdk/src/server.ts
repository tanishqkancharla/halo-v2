import { os, type } from "@orpc/server";
import { RemoteServer } from "@tandem/server";
import type { RuntimeSchemaDefinition } from "@tandem/core";
import type { AnySchema, ClientId, RemoteApi } from "@tandem/types";
import { AsyncEventQueue } from "./AsyncEventQueue.js";
import { FileRemoteStore, PluginStorageStoreError } from "./FileRemoteStore.js";
import type { PluginToolsFacade } from "./PluginToolsFacade.js";

export type PluginServerContext = {
  pluginId: string;
  workspaceRoot: string;
  tools: PluginToolsFacade;
};

export const pluginOs = os.$context<PluginServerContext>();

export {
  type PluginToolInput,
  type PluginToolResult,
  type PluginToolsFacade,
  type PluginToolValue,
} from "./PluginToolsFacade.js";
export { os, type, PluginStorageStoreError };

export function syncRoutes<Schema extends AnySchema>(
  tables: RuntimeSchemaDefinition<Schema>,
) {
  const collections = Object.keys(tables.collections);
  let remote: RemoteServer | undefined;

  async function pluginRemote(context: PluginServerContext) {
    if (remote !== undefined) return remote;
    const store = await FileRemoteStore.open({
      pluginId: context.pluginId,
      workspaceRoot: context.workspaceRoot,
      collections,
    });
    if (store instanceof Error) return store;
    remote = new RemoteServer({ store });
    return remote;
  }

  return {
    sync: {
      push: pluginOs
        .input(type<Parameters<RemoteApi<AnySchema>["push"]>[0]>())
        .handler(async ({ input, context }) => {
          const opened = await pluginRemote(context);
          if (opened instanceof Error) return opened;
          return opened.push(input).catch(
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
          const opened = await pluginRemote(context);
          if (opened instanceof Error) return opened;
          return opened.pull(input).catch(
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
          const opened = await pluginRemote(context);
          if (opened instanceof Error) return opened;
          const queue = new AsyncEventQueue<{ type: "poke" }>();
          const unsubscribe = await opened
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
