import type { AgentSession } from "@mariozechner/pi-coding-agent";
import * as errore from "errore";

export class SessionNotOpenError extends errore.createTaggedError({
  name: "SessionNotOpenError",
  message: "Agent session '$sessionId' is not open.",
}) {}

export class AgentSessionRegistry {
  add(_session: AgentSession) {}

  get(sessionId: string) {
    return new SessionNotOpenError({ sessionId });
  }

  close(sessionId: string) {
    return new SessionNotOpenError({ sessionId });
  }

  closeAll() {}
}
