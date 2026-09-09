import * as errore from "errore";
import { test as baseTest } from "vitest";
import { createTestArtifacts } from "./TestArtifacts.js";
import { createOpenAILLMApi } from "@get-halo/server/llm";
import { LLMDriver } from "@get-halo/server/testing";
import { TestServer } from "./TestServer.js";

type ServerOptions = { workspaceRoot?: string };

export const serverTest = baseTest.extend<{
  llm: LLMDriver;
  server: TestServer;
  createServer: (options?: ServerOptions) => TestServer;
}>({
  // oxlint-disable-next-line eslint/no-empty-pattern -- Vitest fixture callbacks require destructured parameters.
  llm: async ({}, use) => {
    const llm = await LLMDriver.start();
    if (llm instanceof Error) throw llm;
    await using cleanup = new errore.AsyncDisposableStack();
    cleanup.defer(() => llm.close());
    await use(llm);
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
        llmApi: createOpenAILLMApi(llm.configuration),
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
