import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

export type { AgentSessionEvent };
export type { AgentMessage } from "./sessionLog.js";
export type { PluginList, PluginLoadError } from "./plugin.js";

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

export type WorkspaceTreeEvent =
  | { type: "create"; path: string }
  | { type: "delete"; path: string };
