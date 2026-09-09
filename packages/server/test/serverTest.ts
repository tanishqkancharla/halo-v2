import * as errore from "errore";
import { test as baseTest } from "vitest";
import { createTestArtifacts } from "./TestArtifacts.js";
import { fauxAssistantMessage, type Context } from "@earendil-works/pi-ai";
import type { MessageDialect } from "@get-halo/shared/testing";
import { ScriptedLLMApi } from "@get-halo/server/testing";
import { TestServer } from "./TestServer.js";

type ResponseDescription = ReturnType<MessageDialect["assistant"]>;
type Responder = (
  context: Context,
) => ResponseDescription | Promise<ResponseDescription>;

type ServerOptions = { workspaceRoot?: string };

export const serverTest = baseTest.extend<{
  llm: {
    api: ScriptedLLMApi;
    waitForRequest(): Promise<void>;
    respond(description: ResponseDescription | Responder): Promise<void>;
  };
  server: TestServer;
  createServer: (options?: ServerOptions) => TestServer;
}>({
  // oxlint-disable-next-line eslint/no-empty-pattern -- Vitest fixture callbacks require destructured parameters.
  llm: async ({}, use) => {
    const api = new ScriptedLLMApi();
    await use({
      api,
      async waitForRequest() {
        const received = await api.waitForRequest();
        if (received instanceof Error) throw received;
      },
      async respond(description) {
        const request = await api.nextRequest();
        if (request instanceof Error) throw request;
        const response =
          // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Accept a static reply or a response callback.
          typeof description === "function"
            ? await description(request.context)
            : description;
        const responded = api.respond({
          id: request.id,
          message: fauxAssistantMessage(response.text),
        });
        if (responded instanceof Error) throw responded;
      },
    });
  },
  server: async ({ createServer }, use) => {
    const server = createServer();
    await server.start();
    await use(server);
  },
  createServer: async ({ task, llm }, use) => {
    await using artifactsCleanup = new errore.AsyncDisposableStack();
    const artifacts = await createTestArtifacts(task.id);
    const outcome = { passed: false };
    artifactsCleanup.defer(() => artifacts.finish(outcome));
    await using cleanup = new errore.AsyncDisposableStack();
    await use((options = {}) => {
      const server = new TestServer({
        artifacts,
        llmApi: llm.api,
        workspaceRoot:
          options.workspaceRoot === undefined
            ? artifacts.paths.workspace
            : options.workspaceRoot,
      });
      cleanup.defer(() => server.stop());
      return server;
    });
    await cleanup.disposeAsync();
    outcome.passed = task.result?.state === "pass";
  },
});
