import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import type { AgentSessionState } from "./AgentSessionState.js";

export type { AgentSessionEvent, AgentSessionState };
export type {
  CompiledPluginView,
  PluginList,
  PluginLoadError,
} from "./plugin.js";
export {
  agentSessionStateFromSession,
  applyAgentSessionEvent,
  emptyAgentSessionState,
} from "./AgentSessionState.js";

/** Pi agent message carried on session events and durable sessions. */
export type AgentMessage = Extract<
  AgentSessionEvent,
  { type: "message_end" }
>["message"];

export type WorkspaceInfo = {
  name: string;
  workspaceRoot: string;
};

export type SessionSummary = {
  sessionId: string;
  agent: "pi";
  cwd: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
};

export type AppUpdateStatus =
  | { state: "disabled"; reason: string }
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };

export type AppInfo = {
  version: string;
  update: AppUpdateStatus;
};

export type WorkspaceTreeEvent =
  | { type: "create"; path: string }
  | { type: "delete"; path: string };
