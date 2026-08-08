import {
  createAgentSession,
  createCodingTools,
  SessionManager,
  type SessionInfo,
  type SessionMessageEntry,
} from "@mariozechner/pi-coding-agent";
import * as errore from "errore";
import type {
  SessionMessage,
  SessionSummary,
  SessionTranscript,
} from "../shared/rpc.js";
import { WorkspaceService, type WorkspaceLayout } from "./workspace-service.js";

export class SessionNotFoundError extends errore.createTaggedError({
  name: "SessionNotFoundError",
  message: "Session '$sessionId' does not exist.",
}) {}

export class CreateAgentSessionError extends errore.createTaggedError({
  name: "CreateAgentSessionError",
  message: "Failed to create agent session",
}) {}

/**
 * Stateless Pi SDK proxy: SessionManager for durable list/read, createAgentSession
 * for live AgentSession. Callers own subscribe / prompt / dispose.
 */
export class PiService {
  constructor(private readonly workspace: WorkspaceService) {}

  async newAgentSession() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const manager = SessionManager.create(layout.root, layout.sessionDir);
    return this.createAgentSession(layout, manager);
  }

  async openAgentSession(sessionId: string) {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const manager = await this.openSessionManager(layout, sessionId);
    if (manager instanceof Error) return manager;
    return this.createAgentSession(layout, manager);
  }

  private async createAgentSession(
    layout: WorkspaceLayout,
    manager: SessionManager,
  ) {
    const created = await createAgentSession({
      cwd: layout.root,
      agentDir: layout.agentDir,
      sessionManager: manager,
      tools: createCodingTools(layout.root),
    }).catch((e) => new CreateAgentSessionError({ cause: e }));
    if (created instanceof Error) return created;
    return created.session;
  }

  async listSessions() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const sessions = await SessionManager.list(layout.root, layout.sessionDir);
    return sessions
      .map((session) => sessionSummary(session))
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async readTranscript(sessionId: string) {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const manager = await this.openSessionManager(layout, sessionId);
    if (manager instanceof Error) return manager;
    const messages = manager
      .getBranch()
      .filter((entry): entry is SessionMessageEntry => entry.type === "message")
      .flatMap(sessionMessage);
    return { messages } satisfies SessionTranscript;
  }

  private async openSessionManager(layout: WorkspaceLayout, sessionId: string) {
    const sessions = await SessionManager.list(layout.root, layout.sessionDir);
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (session === undefined) return new SessionNotFoundError({ sessionId });
    return SessionManager.open(session.path, layout.sessionDir);
  }
}

function sessionSummary(session: SessionInfo): SessionSummary {
  const title =
    session.name === undefined ? session.firstMessage : session.name;
  return {
    sessionId: session.id,
    agent: "pi",
    cwd: session.cwd,
    title: title.trim().length === 0 ? undefined : title,
    createdAt: session.created.toISOString(),
    updatedAt: session.modified.toISOString(),
  };
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
