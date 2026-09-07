import { implement } from "@orpc/server";
import * as errore from "errore";
import { contract } from "@get-halo/shared/contract";
import { orpcErrors } from "../orpcErrors.js";
import type { SessionRegistry } from "../sessions/SessionRegistry.js";
import type { ToolRuntimeService } from "../agent/runtime/ToolRuntimeService.js";

class TestingApiUnavailableError extends errore.createTaggedError({
  name: "TestingApiUnavailableError",
  message: "The testing API is unavailable outside an E2E run.",
}) {}

class TestingToolNotFoundError extends errore.createTaggedError({
  name: "TestingToolNotFoundError",
  message: "Executor has no user-facing tool at '$path'.",
}) {}

class TestingToolInvocationError extends errore.createTaggedError({
  name: "TestingToolInvocationError",
  message: "Tool '$path' failed: $detail",
}) {}

export type TestingRouterContext = {
  sessions: SessionRegistry;
  toolRuntime: ToolRuntimeService;
  testingApiEnabled: boolean;
};

const os = implement(contract.testHarness).$context<TestingRouterContext>();

export const testingRouter = os.router({
  invokeTool: os.invokeTool.handler(async ({ input, context, signal }) => {
    if (!context.testingApiEnabled) {
      return orpcErrors.badRequest(new TestingApiUnavailableError());
    }
    const runtime = await context.toolRuntime.get();
    if (runtime instanceof Error) return orpcErrors.badRequest(runtime);
    const result = await runtime.invokePath({
      path: input.path,
      args: input.input,
      signal,
    });
    if (result instanceof Error) return orpcErrors.badRequest(result);
    if (!result.ok) {
      return orpcErrors.badRequest(
        new TestingToolInvocationError({
          path: input.path,
          detail: result.error.message,
        }),
      );
    }
    return result.data;
  }),
  appendSessionEvents: os.appendSessionEvents.handler(
    async ({ input, context }) => {
      if (!context.testingApiEnabled) {
        return orpcErrors.badRequest(new TestingApiUnavailableError());
      }
      const session = await context.sessions.open(input.sessionId);
      if (session instanceof Error) return orpcErrors.badRequest(session);
      const appended = await session.appendEvents(input.events);
      if (appended instanceof Error) return orpcErrors.badRequest(appended);
    },
  ),
  getToolIdentity: os.getToolIdentity.handler(async ({ input, context }) => {
    if (!context.testingApiEnabled) {
      return orpcErrors.badRequest(new TestingApiUnavailableError());
    }
    const runtime = await context.toolRuntime.get();
    if (runtime instanceof Error) return orpcErrors.badRequest(runtime);
    const identity = runtime.getToolIdentity(input.path);
    if (identity === undefined) {
      return orpcErrors.badRequest(
        new TestingToolNotFoundError({ path: input.path }),
      );
    }
    return identity;
  }),
});
