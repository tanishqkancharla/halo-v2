import { TandemClient, type Transaction } from "@tandem/core";
import type {
  RelationalQuery,
  RelationalQueryResult,
  RuntimeRelationsDefinition,
  RuntimeSchemaDefinition,
} from "@tandem/core";
import type { AnySchema, RemoteApi } from "@tandem/types";
import * as errore from "errore";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { orpcSyncRemote } from "./OrpcSyncRemote.js";
import {
  PluginRuntimeContext,
  PluginRuntimeMissingError,
  type PluginRuntimeValue,
} from "./PluginRuntime.js";

export class PluginStorageMissingError extends errore.createTaggedError({
  name: "PluginStorageMissingError",
  message: "usePluginQuery must run inside PluginStorageProvider",
}) {}

export type PluginTransaction<Schema extends AnySchema> = {
  transact: () => Transaction<Schema>;
  commit: (tx: Transaction<Schema>) => Promise<void>;
};

const PluginStorageContext = createContext<unknown>(undefined);

const clients = new Map<string, unknown>();

export function PluginStorageProvider<Schema extends AnySchema>(args: {
  tables: RuntimeSchemaDefinition<Schema>;
  sync?: RemoteApi<Schema>;
  children: ReactNode;
}): ReactNode {
  const runtime = useContext(PluginRuntimeContext);
  if (runtime === undefined) throw new PluginRuntimeMissingError();
  const remote =
    args.sync !== undefined
      ? args.sync
      : remoteFromServer<Schema>(runtime.server);
  if (remote === undefined) throw new PluginRuntimeMissingError();
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

export function usePluginQuery<
  Schema extends AnySchema,
  Query extends RelationalQuery<Schema, Relations>,
  Relations extends RuntimeRelationsDefinition<Schema> =
    RuntimeRelationsDefinition<Schema>,
>(query: Query): RelationalQueryResult<Schema, Relations, Query> {
  const client = useContext(PluginStorageContext);
  if (client === undefined) throw new PluginStorageMissingError();
  // SAFETY: PluginStorageProvider constructs this client with the plugin schema.
  const typed = client as TandemClient<Schema, Relations>;
  const [result, setResult] = useState(() => typed.query(query));
  useEffect(() => typed.subscribe(query, setResult).destroy, [typed, query]);
  return result;
}

export function usePluginTransaction<
  Schema extends AnySchema,
>(): PluginTransaction<Schema> {
  const client = useContext(PluginStorageContext);
  if (client === undefined) throw new PluginStorageMissingError();
  // SAFETY: PluginStorageProvider constructs this client with the plugin schema.
  const typed = client as TandemClient<Schema>;
  return {
    transact: () => typed.transact(),
    commit: (tx) => typed.commit(tx),
  };
}

function remoteFromServer<Schema extends AnySchema>(
  server: PluginRuntimeValue["server"],
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
