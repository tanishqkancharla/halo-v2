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

export type SystemApi = {
  getWorkspace: () => Promise<WorkspaceInfo | null>;
  chooseWorkspace: () => Promise<WorkspaceInfo | null>;
  listSessions: () => Promise<SessionSummary[]>;
  readSessionTranscript: (sessionId: string) => Promise<SessionTranscript>;
  createSession: () => Promise<SessionSummary>;
  sendPrompt: (
    sessionId: string,
    prompt: string,
    onEvent: PromptEventHandler,
  ) => Promise<void>;
};
