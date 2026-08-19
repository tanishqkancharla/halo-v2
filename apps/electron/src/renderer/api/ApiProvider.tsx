import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as errore from "errore";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { WorkspaceInfo } from "../../shared/rpc.js";
import { loadPluginViews } from "../evaluatePluginView.js";
import { LoadingPage } from "../LoadingPage.tsx";
import type { HaloApiStub } from "./HaloRpcClient.js";

class WorkspaceRestoreError extends errore.createTaggedError({
  name: "WorkspaceRestoreError",
  message: "Workspace restore failed",
}) {}

export type WorkspaceState =
  | { status: "needs-workspace"; message?: string }
  | { status: "ready"; workspace: WorkspaceInfo };

type ApiContextValue = {
  api: HaloApiStub;
  queryClient: QueryClient;
};

const ApiContext = createContext<ApiContextValue>(undefined!);
const haloApiQueryKey = ["halo-api"] as const;
const workspaceQueryKey = ["workspace"] as const;

export function ApiProvider({
  createApi,
  children,
}: {
  createApi: () => Promise<HaloApiStub>;
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
  createApi: () => Promise<HaloApiStub>;
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

export function useApi(): HaloApiStub {
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
  const { api, queryClient } = useContext(ApiContext);
  return useMutation({
    mutationFn: () => api.chooseWorkspace(),
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
    queryFn: () => api.listSessions(),
    enabled: workspaceRoot !== undefined,
  });
}

export function useWorkspacePathsQuery(workspace: WorkspaceState | undefined) {
  const api = useApi();
  const workspaceRoot =
    workspace?.status === "ready"
      ? workspace.workspace.workspaceRoot
      : undefined;

  return useQuery({
    queryKey: ["workspace-paths", workspaceRoot],
    queryFn: () => api.listWorkspacePaths(),
    enabled: workspaceRoot !== undefined,
  });
}

export function useAppInfoQuery() {
  const api = useApi();
  return useQuery({
    queryKey: ["app-info"],
    queryFn: () => api.getAppInfo(),
    refetchInterval: 5_000,
  });
}

export function usePluginsQuery(workspace: WorkspaceState | undefined) {
  const api = useApi();
  const workspaceRoot =
    workspace?.status === "ready"
      ? workspace.workspace.workspaceRoot
      : undefined;

  return useQuery({
    queryKey: ["plugins", workspaceRoot],
    queryFn: async () => loadPluginViews(await api.listPlugins()),
    enabled: workspaceRoot !== undefined,
  });
}

async function restoreWorkspace(api: HaloApiStub): Promise<WorkspaceState> {
  const active = await api
    .getWorkspace()
    .catch((e) => new WorkspaceRestoreError({ cause: e }));
  if (active instanceof Error) {
    return { status: "needs-workspace", message: active.message };
  }
  if (active !== undefined) return readyWorkspace(active);

  const selected = await api
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
