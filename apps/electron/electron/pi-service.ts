import { join } from "node:path";
import {
  AuthStorage,
  type AgentSession,
  createAgentSession,
  createCodingTools,
  ModelRegistry,
  SessionManager,
  type SessionInfo,
  type SessionMessageEntry,
} from "@mariozechner/pi-coding-agent";
import type {
  PromptEventHandler,
  SessionMessage,
  SessionSummary,
  SessionTranscript,
} from "../src/api/SystemApi.js";
import { WorkspaceService, type WorkspaceLayout } from "./workspace-service.js";

type AgentSessionFactory = typeof createAgentSession;

export class PiService {
  private readonly runningSessions = new Map<string, AgentSession>();
  private readonly draftSessions = new Map<string, SessionManager>();

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly createSession: AgentSessionFactory = createAgentSession,
  ) {}

  async createNewSession(): Promise<SessionSummary> {
    const layout = this.workspace.getLayout();
    const manager = SessionManager.create(layout.root, layout.sessionDir);
    const header = manager.getHeader()!;
    this.draftSessions.set(manager.getSessionId(), manager);
    return {
      sessionId: manager.getSessionId(),
      agent: "pi",
      cwd: layout.root,
      state: "idle",
      createdAt: header.timestamp,
      updatedAt: header.timestamp,
    };
  }

  async listSessions(): Promise<SessionSummary[]> {
    const layout = this.workspace.getLayout();
    const sessions = await SessionManager.list(layout.root, layout.sessionDir);
    return sessions
      .map((session) => this.sessionSummary(session))
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async readTranscript(sessionId: string): Promise<SessionTranscript> {
    const layout = this.workspace.getLayout();
    const manager = await this.getSessionManager(layout, sessionId);
    const messages = manager
      .getBranch()
      .filter((entry): entry is SessionMessageEntry => entry.type === "message")
      .flatMap(sessionMessage);
    return { messages };
  }

  async sendPrompt(
    sessionId: string,
    prompt: string,
    onEvent: PromptEventHandler,
  ): Promise<void> {
    if (prompt.trim().length === 0) {
      throw new Error("Enter a prompt first.");
    }
    if (this.runningSessions.has(sessionId)) {
      throw new Error("This session is already running.");
    }

    const layout = this.workspace.getLayout();
    const manager = await this.getSessionManager(layout, sessionId);
    const authStorage = AuthStorage.create(join(layout.agentDir, "auth.json"));
    const modelRegistry = new ModelRegistry(
      authStorage,
      join(layout.agentDir, "models.json"),
    );
    const { session } = await this.createSession({
      cwd: layout.root,
      agentDir: layout.agentDir,
      authStorage,
      modelRegistry,
      sessionManager: manager,
      tools: createCodingTools(layout.root),
    });
    this.runningSessions.set(sessionId, session);
    const unsubscribe = session.subscribe((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        onEvent({
          type: "delta",
          sessionId,
          text: event.assistantMessageEvent.delta,
        });
      }
    });

    try {
      await session.prompt(prompt);
      this.draftSessions.delete(sessionId);
    } finally {
      unsubscribe();
      this.runningSessions.delete(sessionId);
      session.dispose();
    }
  }

  async shutdown(): Promise<void> {
    const sessions = [...this.runningSessions.values()];
    for (const session of sessions) {
      await session.abort();
      session.dispose();
    }
    this.runningSessions.clear();
  }

  private async findSession(
    layout: WorkspaceLayout,
    sessionId: string,
  ): Promise<SessionInfo> {
    const sessions = await SessionManager.list(layout.root, layout.sessionDir);
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (session === undefined) {
      throw new Error(`Session '${sessionId}' does not exist.`);
    }
    return session;
  }

  private async getSessionManager(
    layout: WorkspaceLayout,
    sessionId: string,
  ): Promise<SessionManager> {
    const draft = this.draftSessions.get(sessionId);
    if (draft !== undefined) return draft;
    const info = await this.findSession(layout, sessionId);
    return SessionManager.open(info.path, layout.sessionDir);
  }

  private sessionSummary(session: SessionInfo): SessionSummary {
    const title =
      session.name === undefined ? session.firstMessage : session.name;
    return {
      sessionId: session.id,
      agent: "pi",
      cwd: session.cwd,
      state: this.runningSessions.has(session.id) ? "running" : "idle",
      title: title.trim().length === 0 ? undefined : title,
      createdAt: session.created.toISOString(),
      updatedAt: session.modified.toISOString(),
    };
  }
}

function sessionMessage(entry: SessionMessageEntry): SessionMessage[] {
  const message = entry.message;
  if (message.role !== "user" && message.role !== "assistant") return [];
  const text = collectText(message.content);
  if (text.length === 0) return [];
  return [
    {
      id: entry.id,
      role: message.role,
      text,
      timestamp: entry.timestamp,
    },
  ];
}

function collectText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((part) => {
      if (typeof part !== "object" || part === null) return [];
      if (!("type" in part) || part.type !== "text") return [];
      if (!("text" in part) || typeof part.text !== "string") return [];
      return [part.text];
    })
    .join("");
}
