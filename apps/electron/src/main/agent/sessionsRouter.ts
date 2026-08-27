import { implement } from "@orpc/server";
import { AsyncEventQueue } from "@halo/plugin-sdk/shared";
import type { Logger } from "@repo/logger";
import { contract } from "../../shared/contract.js";
import type { AgentSessionEvent } from "../../shared/rpc.js";
import { orpcErrors } from "../orpcErrors.js";
import type { SessionRegistry } from "./SessionRegistry.js";

export type SessionsRouterContext = {
  sessions: SessionRegistry;
  logger: Logger;
};

const os = implement(contract.sessions).$context<SessionsRouterContext>();

export const sessionsRouter = os.router({
  list: os.list.handler(async ({ context }) => {
    context.logger.info({ event: "listSessions" });
    const sessions = await context.sessions.list();
    if (sessions instanceof Error) return orpcErrors.badRequest(sessions);
    return sessions;
  }),
  create: os.create.handler(async ({ context }) => {
    context.logger.info({ event: "newAgentSession" });
    const session = await context.sessions.create();
    if (session instanceof Error) return orpcErrors.badRequest(session);
    return { sessionId: session.sessionId };
  }),
  open: os.open.handler(async ({ input, context }) => {
    context.logger.info({
      event: "openAgentSession",
      sessionId: input.sessionId,
    });
    const session = await context.sessions.open(input.sessionId);
    if (session instanceof Error) return orpcErrors.badRequest(session);
    return {
      sessionId: session.sessionId,
      state: session.getState(),
    };
  }),
  events: os.events.handler(async ({ input, context, signal }) => {
    context.logger.info({
      event: "agentSession.events",
      sessionId: input.sessionId,
    });
    const session = await context.sessions.open(input.sessionId);
    if (session instanceof Error) return orpcErrors.badRequest(session);
    const queue = new AsyncEventQueue<AgentSessionEvent>();
    const unsubscribe = session.subscribe((event) => {
      void queue.push(event);
    });
    return (async function* () {
      try {
        yield* queue.values(signal);
      } finally {
        unsubscribe();
      }
    })();
  }),
  prompt: os.prompt.handler(async ({ input, context }) => {
    context.logger.info({
      event: "prompt",
      sessionId: input.sessionId,
      textLength: input.text.length,
    });
    const session = await context.sessions.open(input.sessionId);
    if (session instanceof Error) return orpcErrors.badRequest(session);
    const prompted = await session.prompt(input.text);
    if (prompted instanceof Error) return orpcErrors.badRequest(prompted);
  }),
  abort: os.abort.handler(async ({ input, context }) => {
    context.logger.info({
      event: "abort",
      sessionId: input.sessionId,
    });
    const session = await context.sessions.open(input.sessionId);
    if (session instanceof Error) return orpcErrors.badRequest(session);
    const aborted = await session.abort();
    if (aborted instanceof Error) return orpcErrors.badRequest(aborted);
  }),
  close: os.close.handler(async ({ input, context }) => {
    context.logger.info({
      event: "agentSession.close",
      sessionId: input.sessionId,
    });
    const closed = await context.sessions.close(input.sessionId);
    if (closed instanceof Error) return orpcErrors.badRequest(closed);
  }),
});
