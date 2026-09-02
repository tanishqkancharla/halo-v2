import { implement } from "@orpc/server";
import type { Logger } from "@repo/logger";
import { contract } from "@get-halo/shared/contract";
import {
  connectionRequestLabel,
  type ConnectionRequest,
} from "@get-halo/shared/connectionRequests";
import type { HaloAgentSession } from "../agent/HaloAgentSession.js";
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
    const session = await context.sessions.open(input.sessionId);
    if (session instanceof Error) return orpcErrors.badRequest(session);
    const started = await context.toolRuntime.startConnection({
      sessionId: input.sessionId,
      request: input.request,
      onEvent: async (event) => {
        session.appendConnectionEvent(event);
        if (event.status !== "connected") return;
        const notified = await notifyConnectedSession({
          session,
          request: event.request,
        });
        if (notified instanceof Error) {
          context.logger.warn({
            event: "agentSession.connectionNotificationFailed",
            error: notified,
          });
        }
      },
    });
    if (started instanceof Error) return orpcErrors.badRequest(started);
    if (started.status === "authorization-required") return started;
    const notified = await notifyConnectedSession({
      session,
      request: input.request,
    });
    if (notified instanceof Error) return orpcErrors.badRequest(notified);
    return started;
  }),
  cancelConnection: os.cancelConnection.handler(async ({ input, context }) => {
    context.logger.info({
      event: "agentSession.cancelConnection",
      sessionId: input.sessionId,
      connectionId: input.connectionId,
    });
    const cancelled = await context.toolRuntime.cancelConnection(input);
    if (cancelled instanceof Error) return orpcErrors.badRequest(cancelled);
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

function notifyConnectedSession(args: {
  session: HaloAgentSession;
  request: ConnectionRequest;
}) {
  return args.session.notify({
    customType: "halo.integration.connected",
    content: `[System] The user connected ${connectionRequestLabel(args.request)}. You can now retry the operation that required this connection. Continue the user's last request.`,
  });
}
