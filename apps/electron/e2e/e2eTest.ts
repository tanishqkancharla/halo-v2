import type {
  SessionDescription,
  SessionDescriptionItem,
} from "@get-halo/shared/testing";
import { test as baseTest } from "@playwright/test";
import type { HaloClient } from "@get-halo/shared/contract";
import * as errore from "errore";
import { createTestArtifacts, type TestArtifacts } from "./TestArtifacts.js";
import { ElectronTestApp } from "./ElectronTestApp.js";
import { LLMDriver } from "./LLMDriver.js";
import { createHarnessTools } from "./tools.js";
import {
  loadSessionDescription,
  sessionDescriptionEvents,
} from "./SessionDescription.js";

type E2ESession = {
  sessionId: string;
  append(
    items: SessionDescriptionItem | SessionDescriptionItem[],
  ): Promise<void>;
};

type E2ETestHarness = TestArtifacts["harness"] & {
  tools: ReturnType<typeof createHarnessTools>;
  loadSession(description: SessionDescription): Promise<E2ESession>;
};

type E2EFixtures = {
  llm: LLMDriver;
  app: ElectronTestApp;
  testArtifacts: TestArtifacts;
  harness: E2ETestHarness;
};

export const e2eTest = baseTest.extend<E2EFixtures>({
  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright fixture callbacks require an object-destructured first parameter.
  llm: async ({}, use) => {
    const llm = await LLMDriver.start();
    if (llm instanceof Error) throw llm;
    await using cleanup = new errore.AsyncDisposableStack();
    cleanup.defer(() => llm.close());
    await use(llm);
  },
  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright fixture callbacks require an object-destructured first parameter.
  testArtifacts: async ({}, use, testInfo) => {
    const artifacts = await createTestArtifacts(testInfo);
    await use(artifacts);
    const finished = await artifacts.finish();
    if (finished instanceof Error) throw finished;
  },
  app: [
    async ({ testArtifacts, llm }, use) => {
      await using cleanup = new errore.AsyncDisposableStack();
      const app = new ElectronTestApp(testArtifacts, llm.configuration);
      cleanup.defer(() => app.quit());
      await app.open();
      await use(app);
    },
    { auto: true },
  ],
  harness: async ({ app, testArtifacts }, use) => {
    await use({
      ...testArtifacts.harness,
      tools: createHarnessTools(() => app.server.rpc),
      async loadSession(description) {
        await app.page.getByRole("main").waitFor();
        const loaded = await loadSessionDescription({
          description,
          load: (input) => app.server.rpc.testHarness.loadSession(input),
          getToolIdentity: (path) =>
            app.server.rpc.testHarness.getToolIdentity({ path }),
        });
        if (loaded instanceof Error) throw loaded;
        await app.page.reload();
        await app.page
          .getByRole("link", { name: description.title, exact: true })
          .click();
        await app.page
          .getByRole("main", { name: description.title, exact: true })
          .waitFor();
        return createE2ESession({
          sessionId: loaded.sessionId,
          getServer: () => app.server.rpc,
        });
      },
    });
  },
});

function createE2ESession(args: {
  sessionId: string;
  getServer(): HaloClient;
}): E2ESession {
  return {
    sessionId: args.sessionId,
    async append(items) {
      const server = args.getServer();
      const opened = await server.sessions.open({
        sessionId: args.sessionId,
      });
      const events = await sessionDescriptionEvents({
        items: Array.isArray(items) ? items : [items],
        history: opened.records.map((record) => record.value),
        getToolIdentity: (path) => server.testHarness.getToolIdentity({ path }),
      });
      if (events instanceof Error) throw events;
      await server.testHarness.appendSessionEvents({
        sessionId: args.sessionId,
        events,
      });
    },
  };
}
