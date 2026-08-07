import {
  QueryClient,
  QueryClientProvider,
  skipToken,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { RpcStub } from "capnweb";
import * as errore from "errore";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AgentSessionApi,
  PromptStreamEvent,
  WorkspaceInfo,
} from "../../shared/rpc.js";
import { Onboarding } from "../Onboarding.tsx";
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
const systemApiQueryKey = ["system-api"] as const;
const workspaceQueryKey = ["workspace"] as const;
const sendPromptMutationKey = ["send-prompt"] as const;

export type AgentSessionStub = RpcStub<AgentSessionApi>;
type SendPromptInput = {
  session: AgentSessionStub;
  sessionId: string;
  text: string;
};

export type LivePrompt = {
  sessionId: string;
  userText: string;
  assistantText: string;
  status: "sending" | "failed";
  error?: string;
};

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
    queryKey: systemApiQueryKey,
    queryFn: createApi,
  });

  if (apiQuery.isPending) return <Onboarding status="loading" />;
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

/**
 * Opens a durable Pi AgentSession for a saved chat and keeps it alive until
 * the selection changes. Disposes on leave.
 */
export function useOpenAgentSession(
  sessionId: string | null,
): AgentSessionStub | null {
  const api = useApi();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AgentSessionStub | null>(null);

  useEffect(() => {
    if (sessionId === null) {
      setSession(null);
      return;
    }

    let cancelled = false;
    let stub: AgentSessionStub | undefined;
    void api
      .openAgentSession(sessionId)
      .then((created) => {
        if (cancelled) {
          created[Symbol.dispose]();
          return;
        }
        stub = created;
        void created.subscribe((event) => {
          const key = livePromptKey(event.sessionId);
          const current = queryClient.getQueryData<LivePrompt>(key);
          if (current === undefined) return;
          queryClient.setQueryData(key, applyPromptStreamEvent(current, event));
        });
        setSession(created);
      })
      .catch((e) => {
        console.warn("Failed to open agent session:", e);
      });

    return () => {
      cancelled = true;
      stub?.[Symbol.dispose]();
      setSession(null);
    };
  }, [api, queryClient, sessionId]);

  return session;
}

/** Lazy AgentSession for a draft: created on first send, disposed on leave. */
export function useDraftAgentSession(): {
  ensureSession(): Promise<AgentSessionStub>;
} {
  const api = useApi();
  const queryClient = useQueryClient();
  const sessionRef = useRef<AgentSessionStub | null>(null);

  useEffect(() => {
    return () => {
      sessionRef.current?.[Symbol.dispose]();
      sessionRef.current = null;
    };
  }, []);

  async function ensureSession() {
    if (sessionRef.current !== null) return sessionRef.current;
    const created = await api.newAgentSession();
    sessionRef.current = created;
    await created.subscribe((event) => {
      const key = livePromptKey(event.sessionId);
      const current = queryClient.getQueryData<LivePrompt>(key);
      if (current === undefined) return;
      queryClient.setQueryData(key, applyPromptStreamEvent(current, event));
    });
    return created;
  }

  return { ensureSession };
}

export function useSendPromptMutation() {
  const { api, queryClient } = useContext(ApiContext);
  return useMutation({
    mutationKey: sendPromptMutationKey,
    mutationFn: ({ session, text }: SendPromptInput) => session.prompt(text),
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
        error: error.message,
      });
    },
  });
}

export function useIsSendingPrompt(sessionId: string | null) {
  const count = useIsMutating({
    mutationKey: sendPromptMutationKey,
    predicate: (mutation) =>
      (mutation.state.variables as SendPromptInput | undefined)?.sessionId ===
      sessionId,
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

async function restoreWorkspace(api: HaloApiStub): Promise<WorkspaceState> {
  const active = await api
    .getWorkspace()
    .catch((e) => new WorkspaceRestoreError({ cause: e }));
  if (active instanceof Error) {
    return { status: "needs-workspace", message: active.message };
  }
  if (active !== null) return readyWorkspace(active);

  const selected = await api
    .chooseWorkspace()
    .catch((e) => new WorkspaceRestoreError({ cause: e }));
  if (selected instanceof Error) {
    return { status: "needs-workspace", message: selected.message };
  }
  return selected === null
    ? { status: "needs-workspace" }
    : readyWorkspace(selected);
}

function readyWorkspace(workspace: WorkspaceInfo): WorkspaceState {
  return { status: "ready", workspace };
}
