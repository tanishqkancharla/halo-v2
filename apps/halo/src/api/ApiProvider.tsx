import {
  QueryClient,
  QueryClientProvider,
  skipToken,
  useIsMutating,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  isReadyHealth,
  type ReadyHealthStatus,
  type StartWorkspaceResult,
  type SystemApi,
} from "./SystemApi.ts";

export type WorkspaceState =
  | { status: "needs-owner-slug"; ownerSlug: string; message?: string }
  | {
      status: "ready";
      health: ReadyHealthStatus;
      preferenceWarning?: string;
    };

type ApiContextValue = {
  api: SystemApi;
  queryClient: QueryClient;
};

const ApiContext = createContext<ApiContextValue>(undefined!);
const workspaceQueryKey = ["workspace"] as const;
const sendPromptMutationKey = ["send-prompt"] as const;

type SendPromptInput = { sessionId: string; text: string };

export function ApiProvider({
  api,
  children,
}: {
  api: SystemApi;
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
    <ApiContext value={{ api, queryClient }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiContext>
  );
}

export function useApi() {
  return useContext(ApiContext).api;
}

export function useWorkspaceQuery() {
  const api = useApi();
  return useQuery({
    queryKey: workspaceQueryKey,
    queryFn: () => restoreWorkspace(api),
  });
}

export function useStartWorkspaceMutation() {
  const { api, queryClient } = useContext(ApiContext);
  return useMutation({
    mutationFn: (ownerSlug: string) => api.startWorkspace(ownerSlug.trim()),
    onSuccess: (result) => {
      queryClient.setQueryData(workspaceQueryKey, readyWorkspace(result));
    },
  });
}

export function useSessionsQuery(workspace: WorkspaceState | undefined) {
  const api = useApi();
  const workspaceRoot =
    workspace?.status === "ready" ? workspace.health.workspaceRoot : null;

  return useQuery({
    queryKey: ["sessions", workspaceRoot],
    queryFn: api.listSessions,
    enabled: workspaceRoot !== null,
  });
}

export function useSessionTranscriptQuery(sessionId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["session-transcript", sessionId],
    queryFn:
      sessionId === null
        ? skipToken
        : () => api.readSessionTranscript(sessionId),
  });
}

export function useSendPromptMutation() {
  const { api, queryClient } = useContext(ApiContext);
  return useMutation({
    mutationKey: sendPromptMutationKey,
    mutationFn: ({ sessionId, text }: SendPromptInput) =>
      api.sendPrompt(sessionId, text),
    onSuccess: async (_, { sessionId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({
          queryKey: ["session-transcript", sessionId],
        }),
      ]);
    },
  });
}

export function useCreateSessionMutation() {
  const api = useApi();
  return useMutation({
    mutationFn: () =>
      api.createSession({ sessionId: null, provider: null, model: null }),
  });
}

export function useIsSendingPrompt(sessionId: string | null) {
  const count = useIsMutating({
    mutationKey: sendPromptMutationKey,
    predicate: (mutation) =>
      (mutation.state.variables as SendPromptInput).sessionId === sessionId,
  });
  return count > 0;
}

async function restoreWorkspace(api: SystemApi): Promise<WorkspaceState> {
  let ownerSlug = "";
  try {
    const health = await api.getHealth();
    if (isReadyHealth(health)) {
      return { status: "ready", health };
    }

    const preference = await api.getStartupPreference();
    ownerSlug =
      preference.lastOwnerSlug === undefined ? "" : preference.lastOwnerSlug;
    if (!ownerSlug) return { status: "needs-owner-slug", ownerSlug };
    return readyWorkspace(await api.startWorkspace(ownerSlug));
  } catch (error) {
    return {
      status: "needs-owner-slug",
      ownerSlug,
      message: String(error),
    };
  }
}

function readyWorkspace(result: StartWorkspaceResult): WorkspaceState {
  return {
    status: "ready",
    health: result.health,
    preferenceWarning: result.preferenceWarning,
  };
}
