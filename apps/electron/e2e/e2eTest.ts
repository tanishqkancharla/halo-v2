import { test as baseTest } from "@playwright/test";
import { createHaloRpcClient, readHaloRpcFile, rpcFilePath } from "@halo/cli";
import {
  copyPluginWorkspacePackages,
  installPluginSdkContract,
} from "@get-halo/server/plugins";
import nodePath from "node:path";
import type { HaloClient } from "@get-halo/shared/contract";
import * as errore from "errore";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";
import { createTestArtifacts, type TestArtifacts } from "./TestArtifacts.js";
import { resolveUnpackedExecutable } from "./resolveUnpackedExecutable.js";
import { createHarnessTools } from "./tools.js";
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
  tools: ReturnType<typeof createHarnessTools>;
  openWindow(): Promise<Page>;
  loadSession(description: SessionDescription): Promise<E2ESession>;
};

type E2EServer = {
  host: string;
  port: number;
  rpc: HaloClient;
};

type RunningE2EApp = {
  app: ElectronApplication;
  renderer: { page: Page };
  server: E2EServer;
  close(): Promise<void>;
};

type E2EFixtures = {
  launchApp(): Promise<RunningE2EApp>;
  runningApp: RunningE2EApp;
  agentBrowser: { open(url: string): Promise<Page> };
  testArtifacts: TestArtifacts;
  electronApp: ElectronApplication;
  renderer: { page: Page };
  harness: E2ETestHarness;
  server: E2EServer;
};

export const e2eTest = baseTest.extend<E2EFixtures>({
  agentBrowser: async ({ page }, use) => {
    await use({
      async open(url) {
        await page.goto(url);
        return page;
      },
    });
  },
  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright fixture callbacks require an object-destructured first parameter.
  testArtifacts: async ({}, use, testInfo) => {
    const artifacts = await createTestArtifacts(testInfo);
    await use(artifacts);
    const finished = await artifacts.finish();
    if (finished instanceof Error) throw finished;
  },
  launchApp: async ({ testArtifacts }, use) => {
    await using cleanup = new errore.AsyncDisposableStack();
    await use(async () => {
      const resources = new errore.AsyncDisposableStack();
      cleanup.defer(() => resources.disposeAsync());
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
      resources.defer(() => app.close());
      const captured = testArtifacts.captureProcess(app.process());
      if (captured instanceof Error) throw captured;
      await app.context().tracing.start({ screenshots: true, snapshots: true });
      resources.defer(() =>
        app.context().tracing.stop({ path: testArtifacts.paths.trace }),
      );
      const page = await app.firstWindow();
      const rendererCaptured = await testArtifacts.captureRenderer(page);
      if (rendererCaptured instanceof Error) throw rendererCaptured;
      resources.defer(async () => {
        const screenshot = await testArtifacts.captureScreenshot(page);
        if (screenshot instanceof Error) throw screenshot;
      });
      const connection = await readHaloRpcFile(
        rpcFilePath(testArtifacts.paths.userData),
      );
      if (connection instanceof Error) throw connection;
      return {
        app,
        renderer: { page },
        server: {
          host: connection.host,
          port: connection.port,
          rpc: createHaloRpcClient<HaloClient>(connection),
        },
        close: () => resources.disposeAsync(),
      };
    });
  },
  runningApp: async ({ launchApp }, use) => {
    await use(await launchApp());
  },
  electronApp: async ({ runningApp }, use) => {
    await use(runningApp.app);
  },
  renderer: async ({ runningApp }, use) => {
    await use(runningApp.renderer);
  },
  harness: async ({ electronApp, renderer, server, testArtifacts }, use) => {
    await use({
      ...testArtifacts.harness,
      tools: createHarnessTools(server.rpc),
      async openWindow() {
        const opened = electronApp.waitForEvent("window");
        await electronApp.evaluate(({ app }) =>
          app.emit("halo:e2e:open-window"),
        );
        const page = await opened;
        const captured = await testArtifacts.captureRenderer(page);
        if (captured instanceof Error) throw captured;
        return page;
      },
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
  server: async ({ runningApp, testArtifacts }, use) => {
    const directory = nodePath.join(
      testArtifacts.paths.userData,
      "plugin-dependencies",
    );
    const appVersion = await runningApp.app.evaluate(({ app }) =>
      app.getVersion(),
    );
    const installed = await installPluginSdkContract({ directory, appVersion });
    if (installed instanceof Error) throw installed;
    await copyPluginWorkspacePackages(directory);
    await use(runningApp.server);
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
