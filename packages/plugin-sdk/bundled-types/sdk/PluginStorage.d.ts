import { type Transaction } from "@tandem/core";
import type { RelationalQuery, RelationalQueryResult, RuntimeRelationsDefinition, RuntimeSchemaDefinition } from "@tandem/core";
import type { AnySchema, CollectionName, RemoteApi } from "@tandem/types";
import * as errore from "errore";
import { type ReactNode } from "react";
declare const PluginStorageMissingError_base: errore.FactoryTaggedErrorClass<"PluginStorageMissingError", "usePluginQuery must run inside PluginStorageProvider", Error>;
export declare class PluginStorageMissingError extends PluginStorageMissingError_base {
}
export declare function PluginStorageProvider<Schema extends AnySchema>(args: {
    tables: RuntimeSchemaDefinition<Schema>;
    sync?: RemoteApi<Schema>;
    children: ReactNode;
}): ReactNode;
export declare function usePluginQuery<Row = {
    id: string;
}>(query: {
    collection: string;
    where?: unknown;
}, deps: readonly unknown[]): Row[];
export declare function usePluginQuery<Schema extends AnySchema, Query extends RelationalQuery<Schema, Relations>, Relations extends RuntimeRelationsDefinition<Schema> = RuntimeRelationsDefinition<Schema>>(query: Query, deps: readonly unknown[]): RelationalQueryResult<Schema, Relations, Query>;
export declare function usePluginQuery<Schema extends AnySchema, Query extends RelationalQuery<Schema, Relations>, Relations extends RuntimeRelationsDefinition<Schema> = RuntimeRelationsDefinition<Schema>>(query: Query | undefined, deps: readonly unknown[]): RelationalQueryResult<Schema, Relations, Query> | undefined;
export declare function usePluginTransaction<Schema extends AnySchema, Args extends unknown[]>(callback: (tx: Transaction<Schema>, ...args: Args) => void): (...args: Args) => void;
export declare function usePluginEntity<Schema extends AnySchema, Collection extends CollectionName<Schema>>(collection: Collection, id: Schema[Collection]["id"] | undefined): Schema[Collection] | undefined;
export {};
