import { RpcTarget } from "capnweb";

export type WorkspaceInfo = {
  name: string;
  workspaceRoot: string;
};

export type SessionState = "idle" | "running";

export type SessionSummary = {
  sessionId: string;
  agent: "pi";
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
};

export type PromptStreamEvent = {
  type: "delta";
  sessionId: string;
  text: string;
};

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
