import { test as baseTest } from "@playwright/test";
import { createHaloRpcClient, readHaloRpcFile, rpcFilePath } from "@halo/cli";
import type { HaloClient } from "@get-halo/shared/contract";
import * as errore from "errore";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";
import { createTestArtifacts, type TestArtifacts } from "./TestArtifacts.js";
import { resolveUnpackedExecutable } from "./resolveUnpackedExecutable.js";
import {
  loadSessionDescription,
  sessionDescriptionEvents,
  type SessionDescription,
  type SessionDescriptionItem,
} from "./SessionDescription.js";

type E2ESession = {
  sessionId: string;
  append(
    items: SessionDescriptionItem | SessionDescriptionItem[],
  ): Promise<void>;
};

type E2ETestHarness = TestArtifacts["harness"] & {
  loadSession(description: SessionDescription): Promise<E2ESession>;
};

type E2EFixtures = {
  testArtifacts: TestArtifacts;
  electronApp: ElectronApplication;
  renderer: { page: Page };
  harness: E2ETestHarness;
  server: {
    host: string;
    port: number;
    rpc: HaloClient;
  };
};

export const e2eTest = baseTest.extend<E2EFixtures>({
  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright fixture callbacks require an object-destructured first parameter.
  testArtifacts: async ({}, use, testInfo) => {
    const artifacts = await createTestArtifacts(testInfo);
    await use(artifacts);
    const finished = await artifacts.finish();
    if (finished instanceof Error) throw finished;
  },
  electronApp: async ({ testArtifacts }, use) => {
    await using cleanup = new errore.AsyncDisposableStack();
    const executablePath = resolveUnpackedExecutable();
    if (executablePath instanceof Error) throw executablePath;
    const app = await electron.launch({
      executablePath,
      args: [`--user-data-dir=${testArtifacts.paths.userData}`],
      artifactsDir: testArtifacts.paths.playwright,
      env: {
        ...processEnvironment(),
        HALO_E2E: "1",
      },
    });
    cleanup.defer(() => app.close());
    const captured = testArtifacts.captureProcess(app.process());
    if (captured instanceof Error) throw captured;
    await app.context().tracing.start({ screenshots: true, snapshots: true });
    cleanup.defer(() =>
      app.context().tracing.stop({ path: testArtifacts.paths.trace }),
    );
    const page = await app.firstWindow();
    const rendererCaptured = await testArtifacts.captureRenderer(page);
    if (rendererCaptured instanceof Error) throw rendererCaptured;
    cleanup.defer(async () => {
      const screenshot = await testArtifacts.captureScreenshot(page);
      if (screenshot instanceof Error) throw screenshot;
    });
    await use(app);
  },
  renderer: async ({ electronApp }, use) => {
    await use({ page: await electronApp.firstWindow() });
  },
  harness: async ({ renderer, server, testArtifacts }, use) => {
    await use({
      ...testArtifacts.harness,
      async loadSession(description) {
        await renderer.page.getByRole("main").waitFor();
        const loaded = await loadSessionDescription({
          description,
          workspaceRoot: testArtifacts.paths.workspace,
          getToolIdentity: (path) =>
            server.rpc.testHarness.getToolIdentity({ path }),
        });
        if (loaded instanceof Error) throw loaded;
        await renderer.page.reload();
        await renderer.page
          .getByRole("main", { name: description.title, exact: true })
          .waitFor();
        return createE2ESession({
          sessionId: loaded.sessionId,
          server: server.rpc,
        });
      },
    });
  },
  server: async ({ electronApp, testArtifacts }, use) => {
    await electronApp.firstWindow();
    const connection = await readHaloRpcFile(
      rpcFilePath(testArtifacts.paths.userData),
    );
    if (connection instanceof Error) throw connection;
    await use({
      host: connection.host,
      port: connection.port,
      rpc: createHaloRpcClient<HaloClient>(connection),
    });
  },
});

function createE2ESession(args: {
  sessionId: string;
  server: HaloClient;
}): E2ESession {
  return {
    sessionId: args.sessionId,
    async append(items) {
      const opened = await args.server.sessions.open({
        sessionId: args.sessionId,
      });
      const events = await sessionDescriptionEvents({
        items: Array.isArray(items) ? items : [items],
        history: opened.records.map((record) => record.value),
        getToolIdentity: (path) =>
          args.server.testHarness.getToolIdentity({ path }),
      });
      if (events instanceof Error) throw events;
      await args.server.testHarness.appendSessionEvents({
        sessionId: args.sessionId,
        events,
      });
    },
  };
}

function processEnvironment() {
  // Electron treats the packaged app as a Node process when this inherited variable is present.
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[0] !== "ELECTRON_RUN_AS_NODE" && entry[1] !== undefined,
    ),
  );
}
