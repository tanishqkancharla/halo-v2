import { invoke } from "@tauri-apps/api/core";
import type {
  CreateSessionOptions,
  HealthStatus,
  PromptResponse,
  SessionSummary,
  SessionTranscript,
  StartWorkspaceResult,
  StartupPreference,
  SystemApi,
  WorkspaceEntry,
} from "./SystemApi.ts";

export const tauriApi: SystemApi = {
  getStartupPreference() {
    return invoke<StartupPreference>("get_startup_preference");
  },

  startWorkspace(ownerSlug) {
    return invoke<StartWorkspaceResult>("start_workspace", { ownerSlug });
  },

  getHealth() {
    return invoke<HealthStatus>("sidecar_health");
  },

  writeWorkspaceFile(path, content) {
    return invoke<void>("write_workspace_file", { path, content });
  },

  readWorkspaceFile(path) {
    return invoke<string>("read_workspace_file", { path });
  },

  listWorkspaceFiles(path) {
    return invoke<WorkspaceEntry[]>("list_workspace_files", {
      path: path === undefined ? null : path,
    });
  },

  async listSessions() {
    const sessions = await invoke<SessionSummary[]>("list_sessions");
    // The app's TypeScript target does not include Array.prototype.toSorted.
    // oxlint-disable-next-line unicorn/no-array-sort
    return sessions.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  },

  readSessionTranscript(sessionId) {
    return invoke<SessionTranscript>("read_session_transcript", { sessionId });
  },

  createSession(options) {
    const values: CreateSessionOptions = options === undefined ? {} : options;
    return invoke<SessionSummary>("create_or_reopen_session", {
      sessionId: values.sessionId === undefined ? null : values.sessionId,
      provider: values.provider === undefined ? null : values.provider,
      model: values.model === undefined ? null : values.model,
    });
  },

  sendPrompt(sessionId, prompt) {
    return invoke<PromptResponse>("send_prompt", { sessionId, prompt });
  },
};
