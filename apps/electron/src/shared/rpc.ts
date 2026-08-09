import { RpcTarget } from "capnweb";
import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";

export type { AgentSessionEvent };

/** Pi agent message carried on session events and durable transcripts. */
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

export type SessionTranscript = {
  messages: AgentMessage[];
};

export type AgentSessionEventHandler = (event: AgentSessionEvent) => void;

export abstract class AgentSessionApi extends RpcTarget {
  abstract getSessionId(): string;
  abstract subscribe(callback: AgentSessionEventHandler): void;
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
