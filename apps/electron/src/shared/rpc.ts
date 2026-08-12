import { RpcTarget } from "capnweb";
import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import type { AgentSessionState } from "./AgentSessionState.js";

export type { AgentSessionEvent, AgentSessionState };
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

export type AgentSessionEventHandler = (event: AgentSessionEvent) => void;

export abstract class AgentSessionApi extends RpcTarget {
  abstract getSessionId(): string;
  abstract subscribe(callback: AgentSessionEventHandler): void;
  abstract prompt(text: string): Promise<void>;
}

/** Live session stub plus the durable messages already loaded into it. */
export type OpenedAgentSession = {
  session: AgentSessionApi;
  state: AgentSessionState;
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

export type WorkspaceTreeEventHandler = (events: WorkspaceTreeEvent[]) => void;

export abstract class HaloApi extends RpcTarget {
  abstract getAppInfo(): AppInfo;
  abstract getWorkspace(): WorkspaceInfo | null;
  abstract chooseWorkspace(): Promise<WorkspaceInfo | null>;
  abstract listSessions(): Promise<SessionSummary[]>;
  abstract listWorkspacePaths(): Promise<string[]>;
  abstract subscribeWorkspaceTree(callback: WorkspaceTreeEventHandler): void;
  abstract newAgentSession(): Promise<AgentSessionApi>;
  abstract openAgentSession(sessionId: string): Promise<OpenedAgentSession>;
}
