import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as errore from "errore";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { HaloClient } from "@get-halo/shared/contract";
import type { WorkspaceInfo } from "@get-halo/shared/rpc";
import { LoadingPage } from "../LoadingPage.tsx";
import { ConnectionPage } from "../ConnectionPage.tsx";
import { desktopApi } from "./electron.js";
import {
  IncompatibleServerError,
  type HaloRpcConnectionError,
} from "./HaloRpcClient.js";

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
  createApi: (options: {
    onDisconnect: (error: HaloRpcConnectionError) => void;
  }) => Promise<Error | HaloClient>;
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
  createApi: (options: {
    onDisconnect: (error: HaloRpcConnectionError) => void;
  }) => Promise<Error | HaloClient>;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [disconnected, setDisconnected] = useState(false);
  const disconnect = useCallback((error: Error) => {
    console.warn("Halo disconnected from its server:", error);
    setDisconnected(true);
  }, []);
  const apiQuery = useQuery({
    queryKey: haloApiQueryKey,
    queryFn: () => createApi({ onDisconnect: disconnect }),
  });

  if (apiQuery.isPending) return <LoadingPage />;
  if (apiQuery.isError) {
    console.warn("Halo API initialization failed:", apiQuery.error);
    return <ConnectionPage status="disconnected" />;
  }
  if (disconnected) return <ConnectionPage status="disconnected" />;
  if (apiQuery.data instanceof IncompatibleServerError) {
    return <ConnectionPage status="incompatible" error={apiQuery.data} />;
  }
  if (apiQuery.data instanceof Error) {
    return <ConnectionPage status="disconnected" />;
  }

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

export function useExtensionsQuery(workspace: WorkspaceState | undefined) {
  const api = useApi();
  const workspaceRoot =
    workspace?.status === "ready"
      ? workspace.workspace.workspaceRoot
      : undefined;

  return useQuery({
    queryKey: ["extensions", workspaceRoot],
    queryFn: () => api.extensions.list(),
    enabled: workspaceRoot !== undefined,
  });
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
