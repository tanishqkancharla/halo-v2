import { os, type } from "@orpc/server";
import type { RuntimeSchemaDefinition } from "@tanishqkancharla/tandem-core";
import type { AnySchema, ClientId } from "@tanishqkancharla/tandem-core";
import { PluginStorageStoreError } from "./FileRemoteStore.js";
import type { PluginToolsFacade } from "./PluginToolsFacade.js";
export type PluginServerContext = {
    pluginId: string;
    workspaceRoot: string;
    tools: PluginToolsFacade;
};
export declare const pluginOs: import("@orpc/server").Builder<PluginServerContext & object, Record<never, never>>;
export { type PluginToolInput, type PluginToolResult, type PluginToolsFacade, type PluginToolValue, } from "./PluginToolsFacade.js";
export { os, type, PluginStorageStoreError };
export declare function syncRoutes<Schema extends AnySchema>(tables: RuntimeSchemaDefinition<Schema>): {
    sync: {
        push: import("@orpc/server").DecoratedProcedure<PluginServerContext & object, object, import("@orpc/contract").Schema<{
            mutations: import("@tanishqkancharla/tandem-core").Mutation<AnySchema>[];
            clientId: ClientId;
        }, {
            mutations: import("@tanishqkancharla/tandem-core").Mutation<AnySchema>[];
            clientId: ClientId;
        }>, import("@orpc/contract").Schema<void | PluginStorageStoreError>, Record<never, never>, never>;
        pull: import("@orpc/server").DecoratedProcedure<PluginServerContext & object, object, import("@orpc/contract").Schema<{
            clientId: ClientId;
            cookie?: import("@tanishqkancharla/tandem-core").Cookie;
            scanWindow: import("@tanishqkancharla/tandem-core").ScanWindow<AnySchema>;
        }, {
            clientId: ClientId;
            cookie?: import("@tanishqkancharla/tandem-core").Cookie;
            scanWindow: import("@tanishqkancharla/tandem-core").ScanWindow<AnySchema>;
        }>, import("@orpc/contract").Schema<PluginStorageStoreError | {
            cookie: import("@tanishqkancharla/tandem-core").Cookie;
            patch: import("@tanishqkancharla/tandem-core").Patch<AnySchema>;
            lastMutationId?: import("@tanishqkancharla/tandem-core").MutationId;
        }>, Record<never, never>, never>;
        connect: import("@orpc/server").DecoratedProcedure<PluginServerContext & object, object, import("@orpc/contract").Schema<{
            clientId: ClientId;
        }, {
            clientId: ClientId;
        }>, import("@orpc/contract").Schema<PluginStorageStoreError | AsyncGenerator<{
            type: "poke";
        }, void, unknown>>, Record<never, never>, never>;
    };
};
