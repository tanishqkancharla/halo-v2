import * as errore from "errore";
import {
  HaloAgentSession,
  type HaloAgentSessionOptions,
} from "../agent/HaloAgentSession.js";

export class SessionNotOpenError extends errore.createTaggedError({
  name: "SessionNotOpenError",
  message: "Agent session '$sessionId' is not open.",
}) {}

export class SessionRegistry {
  private readonly sessions = new Map<string, HaloAgentSession>();
  private readonly opening = new Map<
    string,
    Promise<Error | HaloAgentSession>
  >();
  constructor(private readonly options: HaloAgentSessionOptions) {}

  list() {
    return HaloAgentSession.list(this.options);
  }

  async create() {
    const session = await HaloAgentSession.create(this.options);
    if (session instanceof Error) return session;
    this.register(session);
    return session;
  }

  async open(sessionId: string) {
    const live = this.sessions.get(sessionId);
    if (live !== undefined) return live;
    const pending = this.opening.get(sessionId);
    if (pending !== undefined) return await pending;

    const opening = this.openAndRegister(sessionId);
    this.opening.set(sessionId, opening);
    const session = await opening;
    this.opening.delete(sessionId);
    return session;
  }

  async close(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session === undefined) return new SessionNotOpenError({ sessionId });
    this.sessions.delete(sessionId);
    return await session.close();
  }

  async shutdown() {
    const opening = [...this.opening.values()];
    await Promise.all(opening);
    this.opening.clear();

    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    const closed = await Promise.all(
      sessions.map((session) => session.close()),
    );
    const sessionError = closed.find((result) => result instanceof Error);
    if (sessionError instanceof Error) return sessionError;
  }

  private async openAndRegister(sessionId: string) {
    const session = await HaloAgentSession.open({
      ...this.options,
      sessionId,
    });
    if (session instanceof Error) return session;
    this.register(session);
    return session;
  }

  private register(session: HaloAgentSession) {
    this.sessions.set(session.sessionId, session);
  }
}
