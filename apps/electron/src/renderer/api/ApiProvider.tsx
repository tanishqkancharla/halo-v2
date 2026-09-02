import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { AnyRouter, RouterClient } from "@orpc/server";
import * as errore from "errore";
import { createContext, useContext, useState, type ReactNode } from "react";
import type {
  HaloClient,
  PluginInvocationInput,
} from "@get-halo/shared/contract";
import type { WorkspaceInfo } from "@get-halo/shared/rpc";
import {
  loadPluginViews,
  type LoadedPluginList,
} from "../evaluatePluginView.js";
import { LoadingPage } from "../LoadingPage.tsx";
import { desktopApi } from "./electron.js";

class WorkspaceRestoreError extends errore.createTaggedError({
  name: "WorkspaceRestoreError",
  message: "Workspace restore failed",
}) {}

type WorkspaceState =
  | { status: "needs-workspace"; message?: string }
  | { status: "ready"; workspace: WorkspaceInfo };

type ApiContextValue = {
  api: HaloClient;
  queryClient: QueryClient;
};

const ApiContext = createContext<ApiContextValue>(undefined!);
const haloApiQueryKey = ["halo-api"] as const;
const workspaceQueryKey = ["workspace"] as const;

export function ApiProvider({
  createApi,
  children,
}: {
  createApi: () => Promise<HaloClient>;
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: Infinity,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ResolveApi createApi={createApi}>{children}</ResolveApi>
    </QueryClientProvider>
  );
}

function ResolveApi({
  createApi,
  children,
}: {
  createApi: () => Promise<HaloClient>;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const apiQuery = useQuery({
    queryKey: haloApiQueryKey,
    queryFn: createApi,
  });

  if (apiQuery.isPending) return <LoadingPage />;
  if (apiQuery.isError) throw apiQuery.error;

  return (
    <ApiContext value={{ api: apiQuery.data, queryClient }}>
      {children}
    </ApiContext>
  );
}

export function useApi(): HaloClient {
  return useContext(ApiContext).api;
}

export function useWorkspaceQuery() {
  const api = useApi();
  return useQuery({
    queryKey: workspaceQueryKey,
    queryFn: () => restoreWorkspace(api),
  });
}

export function useChooseWorkspaceMutation() {
  const { queryClient } = useContext(ApiContext);
  return useMutation({
    mutationFn: () => desktopApi.chooseWorkspace(),
    onSuccess: (workspace) => {
      if (workspace !== undefined) {
        queryClient.setQueryData(workspaceQueryKey, readyWorkspace(workspace));
      }
    },
  });
}

export function useSessionsQuery(workspace: WorkspaceState | undefined) {
  const api = useApi();
  const workspaceRoot =
    workspace?.status === "ready"
      ? workspace.workspace.workspaceRoot
      : undefined;

  return useQuery({
    queryKey: ["sessions", workspaceRoot],
    queryFn: () => api.sessions.list(),
    enabled: workspaceRoot !== undefined,
  });
}

export function workspacePathsQueryKey(workspaceRoot: string | undefined) {
  return ["workspace-paths", workspaceRoot] as const;
}

export function useWorkspacePathsQuery(workspace: WorkspaceState | undefined) {
  const api = useApi();
  const workspaceRoot =
    workspace?.status === "ready"
      ? workspace.workspace.workspaceRoot
      : undefined;

  return useQuery({
    queryKey: workspacePathsQueryKey(workspaceRoot),
    queryFn: () => api.workspace.listPaths(),
    enabled: workspaceRoot !== undefined,
  });
}

export function useWorkspaceFileQuery(path: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["workspace-file", path],
    queryFn: () => api.workspace.readFile({ path }),
  });
}

export function useAppInfoQuery() {
  return useQuery({
    queryKey: ["app-info"],
    queryFn: () => desktopApi.getAppInfo(),
    refetchInterval: 5_000,
  });
}

export function useInstallAppUpdateMutation() {
  return useMutation({
    mutationFn: () => desktopApi.installAppUpdate(),
  });
}

type PluginServers = Record<string, RouterClient<AnyRouter>>;

type PluginsQueryData = LoadedPluginList & {
  servers: PluginServers;
};

export function usePluginsQuery(
  workspace: WorkspaceState | undefined,
): UseQueryResult<PluginsQueryData> {
  const api = useApi();
  const workspaceRoot =
    workspace?.status === "ready"
      ? workspace.workspace.workspaceRoot
      : undefined;

  return useQuery({
    queryKey: ["plugins", workspaceRoot],
    queryFn: async (): Promise<PluginsQueryData> => {
      const list = await api.plugins.list();
      const loaded = loadPluginViews(list);
      const servers: PluginServers = {};
      for (const plugin of list.plugins) {
        if (plugin.serverPath === undefined) continue;
        servers[plugin.id] = pluginApiFacade(api, plugin.id);
      }
      return { ...loaded, servers };
    },
    enabled: workspaceRoot !== undefined,
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
  if (active !== undefined) return readyWorkspace(active);

  const selected = await desktopApi
    .chooseWorkspace()
    .catch((e) => new WorkspaceRestoreError({ cause: e }));
  if (selected instanceof Error) {
    return { status: "needs-workspace", message: selected.message };
  }
  return selected === undefined
    ? { status: "needs-workspace" }
    : readyWorkspace(selected);
}

function readyWorkspace(workspace: WorkspaceInfo): WorkspaceState {
  return { status: "ready", workspace };
}
