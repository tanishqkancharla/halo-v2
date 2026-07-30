export type HealthStatus = {
  status: "not_started" | "starting" | "ready" | "error" | "stopped";
  sidecarState?: string;
  error?: string;
  databasePath: string;
  workspaceRoot: string;
  credentialConfigured: boolean;
  credentialProviders: string[];
  credentialStorage: string;
};

export type ReadyHealthStatus = HealthStatus & { status: "ready" };

export function isReadyHealth(
  health: HealthStatus,
): health is ReadyHealthStatus {
  return health.status === "ready";
}

export type StartupPreference = {
  lastOwnerSlug?: string;
};

export type StartWorkspaceResult = {
  health: ReadyHealthStatus;
  preferenceSaved: boolean;
  preferenceWarning?: string;
};

export type WorkspaceEntry = {
  path: string;
  name: string;
  isDirectory: boolean;
  isSymbolicLink: boolean;
};

export type SessionState = "idle" | "running" | "waiting" | "failed";

export type SessionSummary = {
  sessionId: string;
  agent: string;
  cwd: string;
  state: SessionState;
  title?: string;
  createdAt: string;
  updatedAt: string;
};

export type MessageRole = "user" | "assistant";

export type SessionMessage = {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: string;
};

export type SessionTranscript = {
  messages: SessionMessage[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
};

export type PromptResponse = {
  sessionId: string;
  output: string;
  message: unknown;
  stopReason: unknown;
};

export type PromptStreamEvent =
  | { type: "delta"; sessionId: string; text: string }
  | { type: "resyncRequired"; sessionId: string };

export type PromptEventHandler = (event: PromptStreamEvent) => void;

export type CreateSessionInput = {
  sessionId: null;
  provider: null;
  model: null;
};

export type SystemApi = {
  getStartupPreference: () => Promise<StartupPreference>;
  startWorkspace: (ownerSlug: string) => Promise<StartWorkspaceResult>;
  getHealth: () => Promise<HealthStatus>;
  writeWorkspaceFile: (path: string, content: string) => Promise<void>;
  readWorkspaceFile: (path: string) => Promise<string>;
  listWorkspaceFiles: (path?: string) => Promise<WorkspaceEntry[]>;
  listSessions: () => Promise<SessionSummary[]>;
  readSessionTranscript: (sessionId: string) => Promise<SessionTranscript>;
  createSession: (input: CreateSessionInput) => Promise<SessionSummary>;
  sendPrompt: (
    sessionId: string,
    prompt: string,
    onEvent: PromptEventHandler,
  ) => Promise<PromptResponse>;
};
