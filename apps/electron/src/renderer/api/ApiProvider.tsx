import type { AnyRouter, RouterClient } from "@orpc/server";
import {
  TandemClientProvider,
  useEntity,
  useTandemQuery,
  type UseTandemQuery,
} from "@tandem/react";
import { TandemClient } from "@tandem/core";
import * as errore from "errore";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  HaloClient,
  PluginInvocationInput,
} from "../../shared/contract.js";
import {
  appInfoFromRow,
  currentId,
  haloTables,
  pathsFromRows,
  sessionFromRow,
  silentTandemLogger,
  workspaceFromRow,
  type HaloSchema,
  type WorkspaceState,
} from "../../shared/HaloTables.ts";
import type { PluginLoadError, LoadedPluginView } from "../../shared/plugin.js";
import { evaluatePluginView } from "../evaluatePluginView.js";
import { LoadingPage } from "../LoadingPage.tsx";
import { haloSyncRemote } from "./HaloSyncRemote.ts";

class ChooseWorkspaceError extends errore.createTaggedError({
  name: "ChooseWorkspaceError",
  message: "Choose workspace failed",
}) {}

class InstallUpdateError extends errore.createTaggedError({
  name: "InstallUpdateError",
  message: "Install app update failed",
}) {}

class IntegrationActionError extends errore.createTaggedError({
  name: "IntegrationActionError",
  message: "Integration action failed",
}) {}

type PluginServers = Record<string, RouterClient<AnyRouter>>;

type ApiContextValue = {
  api: HaloClient;
};

const ApiContext = createContext<ApiContextValue>(undefined!);
const useQuery: UseTandemQuery<HaloSchema> = useTandemQuery;

const tandemClients = new WeakMap<HaloClient, TandemClient<HaloSchema>>();
const pluginServersById = new Map<string, RouterClient<AnyRouter>>();
const pluginViewCache = new Map<
  string,
  { source: string; view: LoadedPluginView | Error }
>();

export function ApiProvider({
  createApi,
  children,
}: {
  createApi: () => Promise<HaloClient>;
  children: ReactNode;
}) {
  const [api, setApi] = useState<HaloClient | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void createApi().then((client) => {
      if (cancelled) return;
      // React setState(fn) is an updater. oRPC clients are function proxies.
      setApi(() => client);
    });
    return () => {
      cancelled = true;
    };
  }, [createApi]);

  if (api === undefined) return <LoadingPage />;

  return (
    <TandemClientProvider
      client={tandemClientFor(api)}
      fallback={<LoadingPage />}
    >
      <ApiContext value={{ api }}>{children}</ApiContext>
    </TandemClientProvider>
  );
}

export function useApi(): HaloClient {
  return useContext(ApiContext).api;
}

export function useWorkspace(): WorkspaceState | undefined {
  const row = useEntity<HaloSchema, "workspaces">("workspaces", currentId);
  if (row === undefined) return undefined;
  return workspaceFromRow(row);
}

export function useChooseWorkspace() {
  const api = useApi();
  const [isChoosing, setIsChoosing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  return {
    isChoosing,
    error,
    choose() {
      void (async () => {
        setIsChoosing(true);
        setError(undefined);
        const workspace = await api.workspace
          .choose()
          .catch((e) => new ChooseWorkspaceError({ cause: e }));
        setIsChoosing(false);
        if (workspace instanceof Error) {
          setError(String(workspace));
        }
      })();
    },
  };
}

export function useSessions() {
  const rows = useQuery({
    collection: "sessions",
    orderBy: { updatedAt: "desc" },
  });
  if (rows === undefined) return [];
  return rows.map(sessionFromRow);
}

export function useWorkspacePaths() {
  const rows = useQuery({ collection: "workspacePaths" });
  if (rows === undefined) return undefined;
  return pathsFromRows(rows);
}

export function useAppInfo() {
  const row = useEntity<HaloSchema, "appInfos">("appInfos", currentId);
  if (row === undefined) return undefined;
  return appInfoFromRow(row);
}

export function useInstallAppUpdate() {
  const api = useApi();
  const [isPending, setIsPending] = useState(false);

  return {
    isPending,
    install() {
      void (async () => {
        setIsPending(true);
        const result = await api
          .installAppUpdate()
          .then(() => undefined)
          .catch((e) => new InstallUpdateError({ cause: e }));
        setIsPending(false);
        if (result instanceof Error) {
          console.warn("Failed to install app update:", result);
        }
      })();
    },
  };
}

export function usePlugins() {
  const api = useApi();
  const pluginRows = useQuery({ collection: "plugins" });
  const viewRows = useQuery({ collection: "pluginViews" });
  const errorRows = useQuery({ collection: "pluginErrors" });
  const views: LoadedPluginView[] = [];
  const errors: PluginLoadError[] =
    errorRows === undefined ? [] : [...errorRows];
  if (viewRows !== undefined) {
    for (const row of viewRows) {
      const loaded = cachedPluginView(row);
      if (loaded instanceof Error) {
        errors.push({ id: row.id, message: loaded.message });
        continue;
      }
      views.push(loaded);
    }
  }
  const servers: PluginServers = {};
  if (pluginRows !== undefined) {
    for (const row of pluginRows) {
      if (!row.hasServer) continue;
      servers[row.id] = pluginServerFor(api, row.id);
    }
  }
  return { views, errors, servers };
}

export function useIntegration(connectionId: string | undefined) {
  const api = useApi();
  const connection = useEntity<HaloSchema, "integrations">(
    "integrations",
    connectionId,
  );
  const [isPending, setIsPending] = useState(false);
  const [disconnected, setDisconnected] = useState(false);

  if (connection !== undefined && disconnected) {
    setDisconnected(false);
  }

  return {
    connection,
    disconnected: disconnected && connection === undefined,
    isPending,
    startOAuth(sessionId: string) {
      if (connectionId === undefined) return;
      void (async () => {
        setIsPending(true);
        const result = await api.integrations
          .startOAuth({ connectionId, sessionId })
          .catch((e) => new IntegrationActionError({ cause: e }));
        setIsPending(false);
        if (result instanceof Error) {
          console.warn("Google OAuth failed:", result);
        }
      })();
    },
    disconnect(sessionId: string) {
      if (connectionId === undefined) return;
      void (async () => {
        setIsPending(true);
        const result = await api.integrations
          .disconnect({ connectionId, sessionId })
          .then(() => undefined)
          .catch((e) => new IntegrationActionError({ cause: e }));
        setIsPending(false);
        if (result instanceof Error) {
          console.warn("Google disconnect failed:", result);
          return;
        }
        setDisconnected(true);
      })();
    },
  };
}

function tandemClientFor(api: HaloClient) {
  const existing = tandemClients.get(api);
  if (existing !== undefined) return existing;
  const client = new TandemClient<HaloSchema>({
    schema: haloTables,
    remote: haloSyncRemote(api.sync),
    autoConnect: true,
    syncInterval: 0,
    logger: silentTandemLogger,
  });
  tandemClients.set(api, client);
  return client;
}

function cachedPluginView(row: { id: string; source: string }) {
  const cached = pluginViewCache.get(row.id);
  if (cached !== undefined && cached.source === row.source) return cached.view;
  const view = evaluatePluginView(row);
  pluginViewCache.set(row.id, { source: row.source, view });
  return view;
}

function pluginServerFor(api: HaloClient, pluginId: string) {
  const existing = pluginServersById.get(pluginId);
  if (existing !== undefined) return existing;
  const server = pluginApiFacade(api, pluginId);
  pluginServersById.set(pluginId, server);
  return server;
}

/**
 * Preserves the plugin's typed router API over Halo's untyped invoke route.
 * `server.todos.list(input)` becomes
 * `plugins.invoke({ pluginId, path: ["todos", "list"], input })`.
 */
function pluginApiFacade(api: HaloClient, pluginId: string) {
  function node(path: string[]): RouterClient<AnyRouter> {
    const invoke = (
      input: PluginInvocationInput["input"],
      options?: { signal?: AbortSignal; lastEventId?: string },
    ) => api.plugins.invoke({ pluginId, path, input }, options);
    // SAFETY: each property appends a procedure path and each call delegates to plugins.invoke.
    return new Proxy(invoke, {
      get(_target, property) {
        // Promise resolution reads `.then`; the facade must not be a thenable.
        if (property === "then") return undefined;
        return node([...path, property.toString()]);
      },
    }) as RouterClient<AnyRouter>;
  }

  return node([]);
}
