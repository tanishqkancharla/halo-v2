import type { AgentSession } from "@mariozechner/pi-coding-agent";
import * as errore from "errore";

export class SessionNotOpenError extends errore.createTaggedError({
  name: "SessionNotOpenError",
  message: "Agent session '$sessionId' is not open.",
}) {}

export class AgentSessionRegistry {
  private readonly sessions = new Map<string, AgentSession>();

  add(session: AgentSession) {
    const existing = this.sessions.get(session.sessionId);
    if (existing !== undefined) this.release(existing);
    this.sessions.set(session.sessionId, session);
  }

  get(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session === undefined) return new SessionNotOpenError({ sessionId });
    return session;
  }

  close(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session === undefined) return new SessionNotOpenError({ sessionId });
    this.release(session);
    this.sessions.delete(sessionId);
  }

  closeAll() {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    for (const session of sessions) {
      this.release(session);
    }
  }

  private release(session: AgentSession) {
    void session.abort().catch((error) => {
      console.warn("Agent session abort failed:", error);
    });
    session.dispose();
  }
}
