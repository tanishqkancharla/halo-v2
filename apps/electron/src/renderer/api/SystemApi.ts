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

export type CreateAgentSessionOptions = {
  sessionId?: string;
};

/** Live Pi AgentSession handle held by the renderer across prompts. */
export type AgentSessionHandle = {
  sessionId: string;
  subscribe(callback: PromptEventHandler): (() => void) | Promise<() => void>;
  prompt(text: string): Promise<void>;
  send(text: string): Promise<void>;
  [Symbol.dispose](): void;
};

export type SystemApi = {
  getWorkspace: () => Promise<WorkspaceInfo | null>;
  chooseWorkspace: () => Promise<WorkspaceInfo | null>;
  listSessions: () => Promise<SessionSummary[]>;
  readSessionTranscript: (sessionId: string) => Promise<SessionTranscript>;
  createAgentSession: (
    options?: CreateAgentSessionOptions,
  ) => Promise<AgentSessionHandle>;
};

/** Cap'n Web main API shape (object-capability; mirrors Pi). */
export type HaloRpcApi = {
  getWorkspace(): Promise<WorkspaceInfo | null>;
  chooseWorkspace(): Promise<WorkspaceInfo | null | Error>;
  listSessions(): Promise<SessionSummary[] | Error>;
  readSessionTranscript(sessionId: string): Promise<SessionTranscript | Error>;
  createAgentSession(
    options?: CreateAgentSessionOptions,
  ): Promise<CreateAgentSessionResult | Error>;
};

export type CreateAgentSessionResult = {
  sessionId: string;
  session: AgentSessionApi;
};

export type AgentSessionApi = {
  subscribe(callback: PromptEventHandler): (() => void) | Promise<() => void>;
  prompt(text: string): Promise<void | Error>;
  send(text: string): Promise<void | Error>;
};
