import { RpcTarget } from "capnweb";
import type { ToolCall } from "./ToolCall.js";

export type { ToolCall } from "./ToolCall.js";

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

export type MessageRole = "user" | "assistant";

export type SessionMessage = {
  id: string;
  role: MessageRole;
  text: string;
  toolCalls: ToolCall[];
  timestamp: string;
};

export type SessionTranscript = {
  messages: SessionMessage[];
};

export type PromptStreamEvent =
  | { type: "delta"; sessionId: string; text: string }
  | { type: "toolCall"; sessionId: string; toolCall: ToolCall };

export type PromptEventHandler = (event: PromptStreamEvent) => void;

export abstract class AgentSessionApi extends RpcTarget {
  abstract getSessionId(): string;
  abstract subscribe(callback: PromptEventHandler): void;
  abstract prompt(text: string): Promise<void>;
}

export abstract class HaloApi extends RpcTarget {
  abstract getWorkspace(): WorkspaceInfo | null;
  abstract chooseWorkspace(): Promise<WorkspaceInfo | null>;
  abstract listSessions(): Promise<SessionSummary[]>;
  abstract readSessionTranscript(sessionId: string): Promise<SessionTranscript>;
  abstract newAgentSession(): Promise<AgentSessionApi>;
  abstract openAgentSession(sessionId: string): Promise<AgentSessionApi>;
}
