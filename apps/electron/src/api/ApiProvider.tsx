import {
  QueryClient,
  QueryClientProvider,
  skipToken,
  useIsMutating,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";
import type {
  PromptStreamEvent,
  SystemApi,
  WorkspaceInfo,
} from "./SystemApi.js";

export type WorkspaceState =
  | { status: "needs-workspace"; message?: string }
  | { status: "ready"; workspace: WorkspaceInfo };

type ApiContextValue = {
  api: SystemApi;
  queryClient: QueryClient;
};

const ApiContext = createContext<ApiContextValue>(undefined!);
const workspaceQueryKey = ["workspace"] as const;
const sendPromptMutationKey = ["send-prompt"] as const;

type SendPromptInput = { sessionId: string; text: string };

export type LivePrompt = {
  sessionId: string;
  userText: string;
  assistantText: string;
  status: "sending" | "failed";
  error?: string;
};

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

export function useChooseWorkspaceMutation() {
  const { api, queryClient } = useContext(ApiContext);
  return useMutation({
    mutationFn: api.chooseWorkspace,
    onSuccess: (workspace) => {
      if (workspace !== null) {
        queryClient.setQueryData(workspaceQueryKey, readyWorkspace(workspace));
      }
    },
  });
}

export function useSessionsQuery(workspace: WorkspaceState | undefined) {
  const api = useApi();
  const workspaceRoot =
    workspace?.status === "ready" ? workspace.workspace.workspaceRoot : null;

  return useQuery({
    queryKey: ["sessions", workspaceRoot],
    queryFn: api.listSessions,
    enabled: workspaceRoot !== null,
  });
}

export function useSessionTranscriptQuery(sessionId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: sessionTranscriptKey(sessionId),
    queryFn:
      sessionId === null
        ? skipToken
        : () => api.readSessionTranscript(sessionId),
  });
}

export function useLivePrompt(sessionId: string | null) {
  return useQuery<LivePrompt>({
    queryKey: livePromptKey(sessionId),
    queryFn: skipToken,
  }).data;
}

export function useSendPromptMutation() {
  const { api, queryClient } = useContext(ApiContext);
  return useMutation({
    mutationKey: sendPromptMutationKey,
    mutationFn: ({ sessionId, text }: SendPromptInput) =>
      api.sendPrompt(sessionId, text, (event) => {
        const key = livePromptKey(sessionId);
        const current = queryClient.getQueryData<LivePrompt>(key)!;
        queryClient.setQueryData(key, applyPromptStreamEvent(current, event));
      }),
    onMutate: ({ sessionId, text }) => {
      queryClient.setQueryData<LivePrompt>(livePromptKey(sessionId), {
        sessionId,
        userText: text,
        assistantText: "",
        status: "sending",
      });
    },
    onSuccess: async (_, { sessionId }) => {
      const transcript = await api.readSessionTranscript(sessionId);
      queryClient.setQueryData(sessionTranscriptKey(sessionId), transcript);
      await queryClient.invalidateQueries({
        queryKey: ["sessions"],
        refetchType: "all",
      });
      queryClient.removeQueries({
        queryKey: livePromptKey(sessionId),
        exact: true,
      });
    },
    onError: (error, { sessionId }) => {
      const key = livePromptKey(sessionId);
      const current = queryClient.getQueryData<LivePrompt>(key)!;
      queryClient.setQueryData(key, {
        ...current,
        status: "failed",
        error: promptFailureMessage(error),
      });
    },
  });
}

export function promptFailureMessage(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  const remotePrefix = "Error invoking remote method 'halo:send-prompt': ";
  if (message.startsWith(remotePrefix)) {
    message = message.slice(remotePrefix.length);
  }
  if (message.startsWith("Error: ")) {
    message = message.slice("Error: ".length);
  }
  return message;
}

export function useCreateSessionMutation() {
  const api = useApi();
  return useMutation({ mutationFn: api.createSession });
}

export function useIsSendingPrompt(sessionId: string | null) {
  const count = useIsMutating({
    mutationKey: sendPromptMutationKey,
    predicate: (mutation) =>
      (mutation.state.variables as SendPromptInput).sessionId === sessionId,
  });
  return count > 0;
}

export function applyPromptStreamEvent(
  current: LivePrompt,
  event: PromptStreamEvent,
): LivePrompt {
  return {
    ...current,
    assistantText: current.assistantText + event.text,
  };
}

function livePromptKey(sessionId: string | null) {
  return ["live-prompt", sessionId] as const;
}

function sessionTranscriptKey(sessionId: string | null) {
  return ["session-transcript", sessionId] as const;
}

async function restoreWorkspace(api: SystemApi): Promise<WorkspaceState> {
  try {
    const active = await api.getWorkspace();
    if (active !== null) return readyWorkspace(active);
    const selected = await api.chooseWorkspace();
    return selected === null
      ? { status: "needs-workspace" }
      : readyWorkspace(selected);
  } catch (error) {
    return { status: "needs-workspace", message: String(error) };
  }
}

function readyWorkspace(workspace: WorkspaceInfo): WorkspaceState {
  return { status: "ready", workspace };
}
