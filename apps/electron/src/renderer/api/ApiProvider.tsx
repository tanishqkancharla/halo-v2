import type { AnyRouter, RouterClient } from "@orpc/server";
import {
  TandemClientProvider,
  useEntity,
  useTandemClient,
  useTandemQuery,
  type UseTandemQuery,
} from "@tandem/react";
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
import type { IntegrationConnection } from "../../shared/integrations.js";
import {
  loadPluginViews,
  type LoadedPluginList,
} from "../evaluatePluginView.js";
import { LoadingPage } from "../LoadingPage.tsx";
import {
  appInfoFromRow,
  appInfoToRow,
  chooseWorkspaceActionId,
  commitWrites,
  currentId,
  haloDb,
  installUpdateActionId,
  integrationActionId,
  integrationLoadId,
  pathRows,
  pathsFromRows,
  pathsLoadId,
  pluginsLoadId,
  replaceCollection,
  sessionFromRow,
  sessionsLoadId,
  sessionToRow,
  workspaceFromRow,
  workspaceToRow,
  type HaloSchema,
  type WorkspaceState,
} from "./HaloTables.ts";
import type { LoadedPluginView, PluginLoadError } from "../../shared/plugin.js";

class WorkspaceRestoreError extends errore.createTaggedError({
  name: "WorkspaceRestoreError",
  message: "Workspace restore failed",
}) {}

class ChooseWorkspaceError extends errore.createTaggedError({
  name: "ChooseWorkspaceError",
  message: "Choose workspace failed",
}) {}

class InstallUpdateError extends errore.createTaggedError({
  name: "InstallUpdateError",
  message: "Install app update failed",
}) {}

class IntegrationLoadError extends errore.createTaggedError({
  name: "IntegrationLoadError",
  message: "Integration load failed",
}) {}

type PluginServers = Record<string, RouterClient<AnyRouter>>;

type ApiContextValue = {
  api: HaloClient;
};

const ApiContext = createContext<ApiContextValue>(undefined!);
const useQuery: UseTandemQuery<HaloSchema> = useTandemQuery;

const pluginViewsById = new Map<string, LoadedPluginView>();
const pluginServersById = new Map<string, RouterClient<AnyRouter>>();
const restoreByApi = new WeakMap<HaloClient, Promise<WorkspaceState>>();

export function ApiProvider({
  createApi,
  children,
}: {
  createApi: () => Promise<HaloClient>;
  children: ReactNode;
}) {
  return (
    <TandemClientProvider client={haloDb} fallback={<LoadingPage />}>
      <ResolveApi createApi={createApi}>{children}</ResolveApi>
    </TandemClientProvider>
  );
}

function ResolveApi({
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
    <ApiContext value={{ api }}>
      <HaloHydrator />
      {children}
    </ApiContext>
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
  const client = useTandemClient<HaloSchema>();
  const action = useEntity<HaloSchema, "actions">(
    "actions",
    chooseWorkspaceActionId,
  );

  return {
    isChoosing: action !== undefined && action.pending,
    error: action?.error,
    choose() {
      void chooseWorkspace(api, client);
    },
  };
}

export function useSessions() {
  const workspace = useWorkspace();
  const rows = useQuery({
    collection: "sessions",
    orderBy: { updatedAt: "desc" },
  });
  const load = useEntity<HaloSchema, "loads">("loads", sessionsLoadId);
  const ready =
    workspace !== undefined &&
    workspace.status === "ready" &&
    load !== undefined &&
    load.ready;
  return {
    sessions: rows === undefined ? [] : rows.map(sessionFromRow),
    ready,
    error: load?.error,
  };
}

export function useWorkspacePaths() {
  const workspace = useWorkspace();
  const rows = useQuery({ collection: "workspacePaths" });
  const load = useEntity<HaloSchema, "loads">("loads", pathsLoadId);
  if (workspace === undefined || workspace.status !== "ready") return undefined;
  if (load === undefined || !load.ready) return undefined;
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
  const client = useTandemClient<HaloSchema>();
  const action = useEntity<HaloSchema, "actions">(
    "actions",
    installUpdateActionId,
  );
  return {
    isPending: action !== undefined && action.pending,
    install() {
      void installAppUpdate(api, client);
    },
  };
}

export function usePlugins() {
  const workspace = useWorkspace();
  const pluginRows = useQuery({ collection: "plugins" });
  const errorRows = useQuery({ collection: "pluginErrors" });
  const load = useEntity<HaloSchema, "loads">("loads", pluginsLoadId);
  const ready =
    workspace !== undefined &&
    workspace.status === "ready" &&
    load !== undefined &&
    load.ready;
  if (pluginRows === undefined || errorRows === undefined) {
    const views: LoadedPluginView[] = [];
    const errors: PluginLoadError[] = [];
    const servers: PluginServers = {};
    return { views, errors, servers, ready };
  }
  const views: LoadedPluginView[] = [];
  const servers: PluginServers = {};
  for (const row of pluginRows) {
    const view = pluginViewsById.get(row.id);
    if (view !== undefined) views.push(view);
    const server = pluginServersById.get(row.id);
    if (server !== undefined) servers[row.id] = server;
  }
  return {
    views,
    errors: errorRows,
    servers,
    ready,
  };
}

export function useIntegration(connectionId: string | undefined) {
  const api = useApi();
  const client = useTandemClient<HaloSchema>();
  const connection = useEntity<HaloSchema, "integrations">(
    "integrations",
    connectionId,
  );
  const loadId =
    connectionId === undefined ? undefined : integrationLoadId(connectionId);
  const load = useEntity<HaloSchema, "loads">("loads", loadId);
  const actionId =
    connectionId === undefined ? undefined : integrationActionId(connectionId);
  const action = useEntity<HaloSchema, "actions">("actions", actionId);

  useEffect(() => {
    if (connectionId === undefined) return;
    let cancelled = false;
    void loadIntegration(api, client, connectionId).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [api, client, connectionId]);

  return {
    connection,
    disconnected: load !== undefined && load.ready && connection === undefined,
    isPending: action !== undefined && action.pending,
    startOAuth(sessionId: string) {
      if (connectionId === undefined) return;
      void runIntegrationAction(api, client, connectionId, () =>
        api.integrations.startOAuth({ connectionId, sessionId }),
      );
    },
    disconnect(sessionId: string) {
      if (connectionId === undefined) return;
      void runIntegrationDisconnect(api, client, connectionId, sessionId);
    },
  };
}

export async function reloadSessions(api: HaloClient) {
  const list = await api.sessions.list();
  await commitWrites(haloDb, (tx) => {
    replaceCollection(tx, "sessions", list.map(sessionToRow));
    tx.set("loads", { id: sessionsLoadId, ready: true });
  });
}

function HaloHydrator() {
  const api = useApi();
  const client = useTandemClient<HaloSchema>();
  const workspace = useEntity<HaloSchema, "workspaces">(
    "workspaces",
    currentId,
  );
  const workspaceRoot =
    workspace !== undefined && workspace.status === "ready"
      ? workspace.workspaceRoot
      : undefined;

  useEffect(() => {
    let cancelled = false;
    void restoreWorkspaceOnce(api).then((state) => {
      if (cancelled) return;
      void commitWrites(client, (tx) => {
        tx.set("workspaces", workspaceToRow(state));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [api, client]);

  useEffect(() => {
    if (workspaceRoot === undefined) return;
    let cancelled = false;
    void (async () => {
      const list = await api.sessions.list();
      if (cancelled) return;
      await commitWrites(client, (tx) => {
        replaceCollection(tx, "sessions", list.map(sessionToRow));
        tx.set("loads", { id: sessionsLoadId, ready: true });
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [api, client, workspaceRoot]);

  useEffect(() => {
    if (workspaceRoot === undefined) return;
    let cancelled = false;
    void (async () => {
      const list = await api.plugins.list();
      if (cancelled) return;
      const loaded = loadPluginViews(list);
      rememberPluginRuntime(api, loaded);
      if (cancelled) return;
      await commitWrites(client, (tx) => {
        replaceCollection(
          tx,
          "plugins",
          loaded.views.map((view) => ({
            id: view.id,
            hasServer: pluginServersById.has(view.id),
          })),
        );
        replaceCollection(tx, "pluginErrors", loaded.errors);
        tx.set("loads", { id: pluginsLoadId, ready: true });
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [api, client, workspaceRoot]);

  useEffect(() => {
    if (workspaceRoot === undefined) return;
    let cancelled = false;
    void (async () => {
      const paths = await api.workspace.listPaths();
      if (cancelled) return;
      await commitWrites(client, (tx) => {
        replaceCollection(tx, "workspacePaths", pathRows(paths));
        tx.set("loads", { id: pathsLoadId, ready: true });
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [api, client, workspaceRoot]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const info = await api.getAppInfo();
      if (cancelled) return;
      await commitWrites(client, (tx) => {
        tx.set("appInfos", appInfoToRow(info));
      });
    }
    void tick();
    const interval = setInterval(() => {
      void tick();
    }, 5_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [api, client]);

  return undefined;
}

function rememberPluginRuntime(api: HaloClient, loaded: LoadedPluginList) {
  pluginViewsById.clear();
  pluginServersById.clear();
  for (const view of loaded.views) {
    pluginViewsById.set(view.id, view);
  }
  for (const plugin of loaded.plugins) {
    if (plugin.serverPath === undefined) continue;
    pluginServersById.set(plugin.id, pluginApiFacade(api, plugin.id));
  }
}

function restoreWorkspaceOnce(api: HaloClient) {
  const existing = restoreByApi.get(api);
  if (existing !== undefined) return existing;
  const promise = restoreWorkspace(api);
  restoreByApi.set(api, promise);
  return promise;
}

async function chooseWorkspace(api: HaloClient, client: typeof haloDb) {
  await commitWrites(client, (tx) => {
    tx.set("actions", { id: chooseWorkspaceActionId, pending: true });
  });
  const workspace = await api.workspace
    .choose()
    .catch((e) => new ChooseWorkspaceError({ cause: e }));
  if (workspace instanceof Error) {
    await commitWrites(client, (tx) => {
      tx.set("actions", {
        id: chooseWorkspaceActionId,
        pending: false,
        error: String(workspace),
      });
    });
    return;
  }
  await commitWrites(client, (tx) => {
    tx.set("actions", { id: chooseWorkspaceActionId, pending: false });
    if (workspace !== undefined) {
      tx.set("workspaces", workspaceToRow({ status: "ready", workspace }));
    }
  });
}

async function installAppUpdate(api: HaloClient, client: typeof haloDb) {
  await commitWrites(client, (tx) => {
    tx.set("actions", { id: installUpdateActionId, pending: true });
  });
  const result = await api
    .installAppUpdate()
    .then(() => undefined)
    .catch((e) => new InstallUpdateError({ cause: e }));
  if (result instanceof Error) {
    await commitWrites(client, (tx) => {
      tx.set("actions", {
        id: installUpdateActionId,
        pending: false,
        error: String(result),
      });
    });
    return;
  }
  await commitWrites(client, (tx) => {
    tx.set("actions", { id: installUpdateActionId, pending: false });
  });
}

async function loadIntegration(
  api: HaloClient,
  client: typeof haloDb,
  connectionId: string,
) {
  const connection = await api.integrations
    .get({ connectionId })
    .catch((e) => new IntegrationLoadError({ cause: e }));
  if (connection instanceof Error) {
    console.warn("Failed to load integration:", connection);
    return;
  }
  await commitWrites(client, (tx) => {
    tx.set("loads", { id: integrationLoadId(connectionId), ready: true });
    if (connection === undefined) {
      tx.remove("integrations", connectionId);
      return;
    }
    tx.set("integrations", connection);
  });
}

async function runIntegrationAction(
  api: HaloClient,
  client: typeof haloDb,
  connectionId: string,
  run: () => Promise<IntegrationConnection>,
) {
  const actionId = integrationActionId(connectionId);
  await commitWrites(client, (tx) => {
    tx.set("actions", { id: actionId, pending: true });
  });
  const connection = await run().catch(
    (e) => new IntegrationLoadError({ cause: e }),
  );
  if (connection instanceof Error) {
    console.warn("Google OAuth failed:", connection);
    await commitWrites(client, (tx) => {
      tx.set("actions", {
        id: actionId,
        pending: false,
        error: String(connection),
      });
    });
    return;
  }
  await commitWrites(client, (tx) => {
    tx.set("actions", { id: actionId, pending: false });
    tx.set("integrations", connection);
    tx.set("loads", { id: integrationLoadId(connectionId), ready: true });
  });
}

async function runIntegrationDisconnect(
  api: HaloClient,
  client: typeof haloDb,
  connectionId: string,
  sessionId: string,
) {
  const actionId = integrationActionId(connectionId);
  await commitWrites(client, (tx) => {
    tx.set("actions", { id: actionId, pending: true });
  });
  const result = await api.integrations
    .disconnect({ connectionId, sessionId })
    .then(() => undefined)
    .catch((e) => new IntegrationLoadError({ cause: e }));
  if (result instanceof Error) {
    console.warn("Google disconnect failed:", result);
    await commitWrites(client, (tx) => {
      tx.set("actions", {
        id: actionId,
        pending: false,
        error: String(result),
      });
    });
    return;
  }
  await commitWrites(client, (tx) => {
    tx.set("actions", { id: actionId, pending: false });
    tx.remove("integrations", connectionId);
    tx.set("loads", { id: integrationLoadId(connectionId), ready: true });
  });
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

async function restoreWorkspace(api: HaloClient): Promise<WorkspaceState> {
  const active = await api.workspace
    .get()
    .catch((e) => new WorkspaceRestoreError({ cause: e }));
  if (active instanceof Error) {
    return { status: "needs-workspace", message: active.message };
  }
  if (active !== undefined) return { status: "ready", workspace: active };

  const selected = await api.workspace
    .choose()
    .catch((e) => new WorkspaceRestoreError({ cause: e }));
  if (selected instanceof Error) {
    return { status: "needs-workspace", message: selected.message };
  }
  return selected === undefined
    ? { status: "needs-workspace" }
    : { status: "ready", workspace: selected };
}
