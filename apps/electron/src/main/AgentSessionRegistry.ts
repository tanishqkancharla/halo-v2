import type {
  AgentSession,
  AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";
import * as errore from "errore";
import { AsyncEventQueue } from "./AsyncEventQueue.js";

export class SessionNotOpenError extends errore.createTaggedError({
  name: "SessionNotOpenError",
  message: "Agent session '$sessionId' is not open.",
}) {}

type TrackedSession = {
  session: AgentSession;
  unsubscribe: (() => void) | undefined;
  queue: AsyncEventQueue<AgentSessionEvent> | undefined;
  deliveries: Promise<void>;
};

export class AgentSessionRegistry {
  private readonly sessions = new Map<string, TrackedSession>();

  add(session: AgentSession) {
    const existing = this.sessions.get(session.sessionId);
    if (existing !== undefined) this.release(existing);
    this.sessions.set(session.sessionId, {
      session,
      unsubscribe: undefined,
      queue: undefined,
      deliveries: Promise.resolve(),
    });
  }

  get(sessionId: string) {
    const tracked = this.sessions.get(sessionId);
    if (tracked === undefined) return new SessionNotOpenError({ sessionId });
    return tracked.session;
  }

  listen(sessionId: string) {
    const tracked = this.sessions.get(sessionId);
    if (tracked === undefined) return new SessionNotOpenError({ sessionId });
    this.detach(tracked);
    const queue = new AsyncEventQueue<AgentSessionEvent>();
    tracked.queue = queue;
    tracked.unsubscribe = tracked.session.subscribe((event) => {
      const delivered = queue.push(event);
      tracked.deliveries = tracked.deliveries.then(() => delivered);
    });
    return queue;
  }

  unlisten(sessionId: string) {
    const tracked = this.sessions.get(sessionId);
    if (tracked === undefined) return;
    this.detach(tracked);
  }

  async waitForDeliveries(sessionId: string) {
    const tracked = this.sessions.get(sessionId);
    if (tracked === undefined) return;
    await tracked.deliveries;
  }

  close(sessionId: string) {
    const tracked = this.sessions.get(sessionId);
    if (tracked === undefined) return new SessionNotOpenError({ sessionId });
    this.release(tracked);
    this.sessions.delete(sessionId);
  }

  closeAll() {
    const tracked = [...this.sessions.values()];
    this.sessions.clear();
    for (const session of tracked) {
      this.release(session);
    }
  }

  private detach(tracked: TrackedSession) {
    if (tracked.unsubscribe !== undefined) {
      tracked.unsubscribe();
      tracked.unsubscribe = undefined;
    }
    if (tracked.queue !== undefined) {
      tracked.queue.close();
      tracked.queue = undefined;
    }
  }

  private release(tracked: TrackedSession) {
    this.detach(tracked);
    void tracked.session.abort().catch((error) => {
      console.warn("Agent session abort failed:", error);
    });
    tracked.session.dispose();
  }
}
