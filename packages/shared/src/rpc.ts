import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

export type { AgentSessionEvent };
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

export type WorkspaceTreeEvent =
  | { type: "create"; path: string }
  | { type: "delete"; path: string };
