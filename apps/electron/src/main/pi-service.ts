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
import * as errore from "errore";
import type {
  PromptEventHandler,
  SessionMessage,
  SessionSummary,
  SessionTranscript,
} from "../renderer/api/SystemApi.js";
import { WorkspaceService, type WorkspaceLayout } from "./workspace-service.js";

export class EmptyPromptError extends errore.createTaggedError({
  name: "EmptyPromptError",
  message: "Enter a prompt first.",
}) {}

export class SessionBusyError extends errore.createTaggedError({
  name: "SessionBusyError",
  message: "This session is already running.",
}) {}

export class SessionNotFoundError extends errore.createTaggedError({
  name: "SessionNotFoundError",
  message: "Session '$sessionId' does not exist.",
}) {}

export class PromptFailedError extends errore.createTaggedError({
  name: "PromptFailedError",
  message: "Prompt failed",
}) {}

type AgentSessionFactory = typeof createAgentSession;

export class PiService {
  private readonly runningSessions = new Map<string, AgentSession>();
  private readonly draftSessions = new Map<string, SessionManager>();

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly createSession: AgentSessionFactory = createAgentSession,
  ) {}

  async createNewSession() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;
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
    } satisfies SessionSummary;
  }

  async listSessions() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const sessions = await SessionManager.list(layout.root, layout.sessionDir);
    return sessions
      .map((session) => this.sessionSummary(session))
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async readTranscript(sessionId: string) {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const manager = await this.getSessionManager(layout, sessionId);
    if (manager instanceof Error) return manager;
    const messages = manager
      .getBranch()
      .filter((entry): entry is SessionMessageEntry => entry.type === "message")
      .flatMap(sessionMessage);
    return { messages } satisfies SessionTranscript;
  }

  async sendPrompt(
    sessionId: string,
    prompt: string,
    onEvent: PromptEventHandler,
  ) {
    if (prompt.trim().length === 0) return new EmptyPromptError();
    if (this.runningSessions.has(sessionId)) return new SessionBusyError();

    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const manager = await this.getSessionManager(layout, sessionId);
    if (manager instanceof Error) return manager;

    const authStorage = AuthStorage.create(join(layout.agentDir, "auth.json"));
    const modelRegistry = new ModelRegistry(
      authStorage,
      join(layout.agentDir, "models.json"),
    );
    const created = await this.createSession({
      cwd: layout.root,
      agentDir: layout.agentDir,
      authStorage,
      modelRegistry,
      sessionManager: manager,
      tools: createCodingTools(layout.root),
    }).catch((e) => new PromptFailedError({ cause: e }));
    if (created instanceof Error) return created;

    const { session } = created;
    await using cleanup = new errore.AsyncDisposableStack();
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
    cleanup.defer(() => {
      unsubscribe();
      this.runningSessions.delete(sessionId);
      session.dispose();
    });

    const prompted = await session
      .prompt(prompt)
      .catch((e) => new PromptFailedError({ cause: e }));
    if (prompted instanceof Error) return prompted;
    this.draftSessions.delete(sessionId);
  }

  async shutdown(): Promise<void> {
    const sessions = [...this.runningSessions.values()];
    for (const session of sessions) {
      await session.abort();
      session.dispose();
    }
    this.runningSessions.clear();
  }

  private async findSession(layout: WorkspaceLayout, sessionId: string) {
    const sessions = await SessionManager.list(layout.root, layout.sessionDir);
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (session === undefined) return new SessionNotFoundError({ sessionId });
    return session;
  }

  private async getSessionManager(
    layout: WorkspaceLayout,
    sessionId: string,
  ): Promise<SessionManager | SessionNotFoundError> {
    const draft = this.draftSessions.get(sessionId);
    if (draft !== undefined) return draft;
    const info = await this.findSession(layout, sessionId);
    if (info instanceof Error) return info;
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
