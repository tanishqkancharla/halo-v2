import { TandemClient, type Transaction } from "@tanishqkancharla/tandem-core";
import type {
  RelationalQuery,
  RelationalQueryResult,
  RuntimeRelationsDefinition,
  RuntimeSchemaDefinition,
} from "@tanishqkancharla/tandem-core";
import type {
  AnySchema,
  CollectionName,
  RemoteApi,
} from "@tanishqkancharla/tandem-core";
import * as errore from "errore";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { orpcSyncRemote } from "./OrpcSyncRemote.js";
import {
  PluginServerMissingError,
  PluginServerProviderContext,
  type PluginServerValue,
} from "./PluginServerProvider.js";

export class PluginStorageMissingError extends errore.createTaggedError({
  name: "PluginStorageMissingError",
  message: "usePluginQuery must run inside PluginStorageProvider",
}) {}

const PluginStorageContext = createContext<unknown>(undefined);

const clients = new Map<string, unknown>();

export function PluginStorageProvider<Schema extends AnySchema>(args: {
  tables: RuntimeSchemaDefinition<Schema>;
  sync?: RemoteApi<Schema>;
  children: ReactNode;
}): ReactNode {
  const runtime = useContext(PluginServerProviderContext);
  if (runtime === undefined) throw new PluginServerMissingError();
  const remote =
    args.sync !== undefined
      ? args.sync
      : remoteFromServer<Schema>(runtime.server);
  if (remote === undefined) throw new PluginServerMissingError();
  const client = pluginClient({
    pluginId: runtime.pluginId,
    tables: args.tables,
    remote,
  });
  return createElement(
    PluginStorageContext.Provider,
    { value: client },
    args.children,
  );
}

export function usePluginQuery<Row = { id: string }>(
  query: { collection: string; where?: unknown },
  deps: readonly unknown[],
): Row[];
export function usePluginQuery<
  Schema extends AnySchema,
  Query extends RelationalQuery<Schema, Relations>,
  Relations extends RuntimeRelationsDefinition<Schema> =
    RuntimeRelationsDefinition<Schema>,
>(
  query: Query,
  deps: readonly unknown[],
): RelationalQueryResult<Schema, Relations, Query>;
export function usePluginQuery<
  Schema extends AnySchema,
  Query extends RelationalQuery<Schema, Relations>,
  Relations extends RuntimeRelationsDefinition<Schema> =
    RuntimeRelationsDefinition<Schema>,
>(
  query: Query | undefined,
  deps: readonly unknown[],
): RelationalQueryResult<Schema, Relations, Query> | undefined;
export function usePluginQuery<
  Schema extends AnySchema,
  Query extends RelationalQuery<Schema, Relations>,
  Relations extends RuntimeRelationsDefinition<Schema> =
    RuntimeRelationsDefinition<Schema>,
>(
  query: Query | undefined,
  deps: readonly unknown[],
): RelationalQueryResult<Schema, Relations, Query> | undefined {
  const client = useContext(PluginStorageContext);
  if (client === undefined) throw new PluginStorageMissingError();
  // SAFETY: PluginStorageProvider constructs this client with the plugin schema.
  const typed = client as TandemClient<Schema, Relations>;
  // Caller passes deps, same as useMemo(fn, deps).
  // oxlint-disable-next-line react/use-memo
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const stableQuery = useMemo(() => query, deps);
  const [value, setValue] = useState(() => {
    if (stableQuery === undefined) return undefined;
    return typed.query(stableQuery);
  });
  useEffect(() => {
    if (stableQuery === undefined) {
      // Tandem subscribe does not emit the first result through the callback.
      // oxlint-disable-next-line react/set-state-in-effect
      setValue(undefined);
      return undefined;
    }
    const { destroy, result } = typed.subscribe(stableQuery, (nextValue) => {
      setValue(nextValue);
    });
    // Tandem subscribe does not emit the first result through the callback.
    // oxlint-disable-next-line react/set-state-in-effect
    setValue(result);
    return destroy;
  }, [typed, stableQuery]);
  return value;
}

export function usePluginTransaction<
  Schema extends AnySchema,
  Args extends unknown[],
>(
  callback: (tx: Transaction<Schema>, ...args: Args) => void,
): (...args: Args) => void {
  const client = useContext(PluginStorageContext);
  if (client === undefined) throw new PluginStorageMissingError();
  // SAFETY: PluginStorageProvider constructs this client with the plugin schema.
  const typed = client as TandemClient<Schema>;
  return useCallback(
    (...args: Args) => {
      const tx = typed.transact();
      callback(tx, ...args);
      void typed.commit(tx);
    },
    [callback, typed],
  );
}

export function usePluginEntity<
  Schema extends AnySchema,
  Collection extends CollectionName<Schema>,
>(
  collection: Collection,
  id: Schema[Collection]["id"] | undefined,
): Schema[Collection] | undefined {
  const query = useMemo(() => {
    if (id === undefined) return undefined;
    return {
      collection,
      where: { id },
    };
  }, [collection, id]);
  const rows = usePluginQuery(query, [query]);
  if (rows === undefined) return undefined;
  // SAFETY: a query of one collection with where id returns that collection's row.
  return rows[0] as Schema[Collection] | undefined;
}

function remoteFromServer<Schema extends AnySchema>(
  server: PluginServerValue["server"],
) {
  if (server === undefined) return undefined;
  // SAFETY: default remote is syncRoutes; RouterClient<AnyRouter> cannot name it.
  return orpcSyncRemote(
    (server as { sync: Parameters<typeof orpcSyncRemote<Schema>>[0] }).sync,
  );
}

function pluginClient<Schema extends AnySchema>(args: {
  pluginId: string;
  tables: RuntimeSchemaDefinition<Schema>;
  remote: RemoteApi<Schema>;
}) {
  const existing = clients.get(args.pluginId);
  if (existing !== undefined) {
    // SAFETY: one TandemClient per pluginId; Sidebar and Routes share it.
    return existing as TandemClient<Schema>;
  }
  const client = new TandemClient<Schema>({
    schema: args.tables,
    remote: args.remote,
    autoConnect: true,
  });
  clients.set(args.pluginId, client);
  return client;
}
