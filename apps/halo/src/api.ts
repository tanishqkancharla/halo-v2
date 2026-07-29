import { invoke } from "@tauri-apps/api/core";

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
};

export type SessionSummary = {
  sessionId: string;
  agent: string;
  cwd: string;
  state: string;
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

export function getStartupPreference(): Promise<StartupPreference> {
  return invoke("get_startup_preference");
}

export function startWorkspace(
  ownerSlug: string,
): Promise<StartWorkspaceResult> {
  return invoke("start_workspace", { ownerSlug });
}

export function getHealth(): Promise<HealthStatus> {
  return invoke("sidecar_health");
}

export function writeWorkspaceFile(
  path: string,
  content: string,
): Promise<void> {
  return invoke("write_workspace_file", { path, content });
}

export function readWorkspaceFile(path: string): Promise<string> {
  return invoke("read_workspace_file", { path });
}

export function listWorkspaceFiles(path?: string): Promise<WorkspaceEntry[]> {
  return invoke("list_workspace_files", { path: path ?? null });
}

export function listSessions(): Promise<SessionSummary[]> {
  return invoke("list_sessions");
}

export function readSessionTranscript(
  sessionId: string,
): Promise<SessionTranscript> {
  return invoke("read_session_transcript", { sessionId });
}

export function createSession(options?: {
  sessionId?: string;
  provider?: string;
  model?: string;
}): Promise<SessionSummary> {
  return invoke("create_or_reopen_session", {
    sessionId: options?.sessionId ?? null,
    provider: options?.provider ?? null,
    model: options?.model ?? null,
  });
}

export function sendPrompt(
  sessionId: string,
  prompt: string,
): Promise<PromptResponse> {
  return invoke("send_prompt", { sessionId, prompt });
}
