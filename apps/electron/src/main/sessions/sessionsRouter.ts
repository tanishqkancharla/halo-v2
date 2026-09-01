import { implement } from "@orpc/server";
import type { Logger } from "@repo/logger";
import { connectionRequestLabel } from "@repo/shared/connectionRequests";
import { contract } from "@repo/shared/contract";
import type { ToolRuntimeService } from "../agent/runtime/ToolRuntimeService.js";
import { orpcErrors } from "../orpcErrors.js";
import type { SessionRegistry } from "./SessionRegistry.js";

export type SessionsRouterContext = {
  sessions: SessionRegistry;
  toolRuntime: ToolRuntimeService;
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
    return session.events.consume(signal);
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
  startConnection: os.startConnection.handler(async ({ input, context }) => {
    context.logger.info({
      event: "agentSession.startConnection",
      sessionId: input.sessionId,
      integration: input.request.integration,
    });
    const connected = await context.toolRuntime.startConnection(input.request);
    if (connected instanceof Error) return orpcErrors.badRequest(connected);
    const session = await context.sessions.open(input.sessionId);
    if (session instanceof Error) return orpcErrors.badRequest(session);
    const notified = await session.notify({
      customType: "halo.integration.connected",
      content: `[System] The user connected ${connectionRequestLabel(input.request)}. You can now retry the operation that required this connection. Continue the user's last request.`,
    });
    if (notified instanceof Error) return orpcErrors.badRequest(notified);
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
