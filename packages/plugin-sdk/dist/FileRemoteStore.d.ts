import type { AnySchema, EncodedQuery, Mutation, Patch } from "@tanishqkancharla/tandem-core";
import type { RemoteStore } from "@tanishqkancharla/tandem-server";
import * as errore from "errore";
declare const PluginStorageStoreError_base: errore.FactoryTaggedErrorClass<"PluginStorageStoreError", "Plugin storage failed for $pluginId", Error>;
export declare class PluginStorageStoreError extends PluginStorageStoreError_base {
}
export declare class FileRemoteStore<Schema extends AnySchema = AnySchema> implements RemoteStore<Schema> {
    private readonly pluginId;
    private readonly path;
    private readonly recordsByCollection;
    private constructor();
    static open<Schema extends AnySchema>(args: {
        pluginId: string;
        workspaceRoot: string;
        collections: readonly string[];
    }): Promise<PluginStorageStoreError | FileRemoteStore<Schema>>;
    applyMutations(mutations: Mutation<Schema>[]): Promise<void>;
    readSnapshot(snapshotQueries: EncodedQuery<Schema>[]): Promise<Patch<Schema>>;
    private readRows;
}
export {};
