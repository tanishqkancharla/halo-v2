import { implement } from "@orpc/server";
import { AsyncEventQueue } from "@halo/plugin-sdk/shared";
import type { Logger } from "@repo/logger";
import { agentSessionStateFromSession } from "../../shared/AgentSessionState.js";
import { contract } from "../../shared/contract.js";
import type { AgentSessionEvent } from "../../shared/rpc.js";
import { orpcErrors } from "../orpcErrors.js";
import {
  AbortFailedError,
  EmptyPromptError,
  PromptFailedError,
} from "./AgentSessionErrors.js";
import type { HaloTandem } from "../HaloTandem.js";
import type { AgentSessionRegistry } from "./AgentSessionRegistry.js";
import type { PiService } from "./PiService.js";

export type SessionsRouterContext = {
  pi: PiService;
  sessions: AgentSessionRegistry;
  tandem: HaloTandem;
  logger: Logger;
};

const os = implement(contract.sessions).$context<SessionsRouterContext>();

export const sessionsRouter = os.router({
  create: os.create.handler(async ({ context }) => {
    context.logger.info({ event: "newAgentSession" });
    const session = await context.pi.newAgentSession();
    if (session instanceof Error) return orpcErrors.badRequest(session);
    context.sessions.add(session);
    await context.tandem.refreshSessions();
    return { sessionId: session.sessionId };
  }),
  open: os.open.handler(async ({ input, context }) => {
    context.logger.info({
      event: "openAgentSession",
      sessionId: input.sessionId,
    });
    const live = context.sessions.get(input.sessionId);
    if (live instanceof Error) {
      const session = await context.pi.openAgentSession(input.sessionId);
      if (session instanceof Error) return orpcErrors.badRequest(session);
      context.sessions.add(session);
      return {
        sessionId: session.sessionId,
        state: agentSessionStateFromSession({
          messages: session.messages,
          isStreaming: session.isStreaming,
        }),
      };
    }
    return {
      sessionId: live.sessionId,
      state: agentSessionStateFromSession({
        messages: live.messages,
        isStreaming: live.isStreaming,
      }),
    };
  }),
  events: os.events.handler(({ input, context, signal }) => {
    context.logger.info({
      event: "agentSession.events",
      sessionId: input.sessionId,
    });
    const session = context.sessions.get(input.sessionId);
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
    const session = context.sessions.get(input.sessionId);
    if (session instanceof Error) return orpcErrors.badRequest(session);
    if (input.text.trim().length === 0)
      return orpcErrors.badRequest(new EmptyPromptError());
    const prompted = await session
      .prompt(input.text, { streamingBehavior: "steer" })
      .catch(
        (e) =>
          new PromptFailedError({
            reason: e instanceof Error ? e.message : String(e),
            cause: e,
          }),
      );
    if (prompted instanceof Error) return orpcErrors.badRequest(prompted);
    await context.tandem.refreshSessions();
  }),
  abort: os.abort.handler(async ({ input, context }) => {
    context.logger.info({
      event: "abort",
      sessionId: input.sessionId,
    });
    const session = context.sessions.get(input.sessionId);
    if (session instanceof Error) return orpcErrors.badRequest(session);
    const aborted = await session.abort().catch(
      (e) =>
        new AbortFailedError({
          reason: e instanceof Error ? e.message : String(e),
          cause: e,
        }),
    );
    if (aborted instanceof Error) return orpcErrors.badRequest(aborted);
  }),
  close: os.close.handler(({ input, context }) => {
    context.logger.info({
      event: "agentSession.close",
      sessionId: input.sessionId,
    });
    const closed = context.sessions.close(input.sessionId);
    if (closed instanceof Error) return orpcErrors.badRequest(closed);
  }),
});
