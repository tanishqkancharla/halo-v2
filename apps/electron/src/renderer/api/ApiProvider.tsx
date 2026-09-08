import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { HaloClient } from "@get-halo/shared/contract";
import type { WorkspaceInfo } from "@get-halo/shared/rpc";
import { Onboarding } from "../Onboarding.tsx";
import { LoadingPage } from "../LoadingPage.tsx";
import { ConnectionPage } from "../ConnectionPage.tsx";
import { desktopApi } from "./electron.js";
import {
  IncompatibleServerError,
  type HaloRpcConnectionError,
} from "./HaloRpcClient.js";

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
  }) => Promise<Error | HaloClient | undefined>;
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
  }) => Promise<Error | HaloClient | undefined>;
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
    queryFn: async () => {
      const api = await createApi({ onDisconnect: disconnect });
      return { api };
    },
  });

  if (apiQuery.isPending) return <LoadingPage />;
  if (apiQuery.isError) {
    console.warn("Halo API initialization failed:", apiQuery.error);
    return <ConnectionPage status="disconnected" />;
  }
  if (disconnected) return <ConnectionPage status="disconnected" />;
  const api = apiQuery.data.api;
  if (api === undefined) return <ChooseWorkspace />;
  if (api instanceof IncompatibleServerError) {
    return <ConnectionPage status="incompatible" error={api} />;
  }
  if (api instanceof Error) {
    return <ConnectionPage status="disconnected" />;
  }

  return <ApiContext value={{ api, queryClient }}>{children}</ApiContext>;
}

export function useApi(): HaloClient {
  return useContext(ApiContext).api;
}

export function useWorkspaceQuery() {
  const api = useApi();
  return useQuery({
    queryKey: workspaceQueryKey,
    queryFn: () => api.workspace.get(),
  });
}

function ChooseWorkspace() {
  const choose = useMutation({
    mutationFn: () => desktopApi.chooseWorkspace(),
    onSuccess: (workspace) => {
      if (workspace !== undefined) window.location.reload();
    },
  });
  return (
    <Onboarding
      message={choose.error === null ? undefined : String(choose.error)}
      isChoosing={choose.isPending}
      onChoose={() => choose.mutate()}
    />
  );
}

export function useSessionsQuery(workspace: WorkspaceInfo | undefined) {
  const api = useApi();
  const workspaceRoot = workspace?.workspaceRoot;

  return useQuery({
    queryKey: ["sessions", workspaceRoot],
    queryFn: () => api.sessions.list(),
    enabled: workspaceRoot !== undefined,
  });
}

export function workspacePathsQueryKey(workspaceRoot: string | undefined) {
  return ["workspace-paths", workspaceRoot] as const;
}

export function useWorkspacePathsQuery(workspace: WorkspaceInfo | undefined) {
  const api = useApi();
  const workspaceRoot = workspace?.workspaceRoot;

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

export function useExtensionsQuery(workspace: WorkspaceInfo | undefined) {
  const api = useApi();
  const workspaceRoot = workspace?.workspaceRoot;

  return useQuery({
    queryKey: ["extensions", workspaceRoot],
    queryFn: () => api.extensions.list(),
    enabled: workspaceRoot !== undefined,
  });
}
