import { test as baseTest } from "@playwright/test";
import { createHaloRpcClient, readHaloRpcFile, rpcFilePath } from "@halo/cli";
import type { HaloClient } from "@get-halo/shared/contract";
import * as errore from "errore";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";
import {
  createTestArtifacts,
  type E2ETestHarness,
  type TestArtifacts,
} from "./TestArtifacts.js";
import { resolveUnpackedExecutable } from "./resolveUnpackedExecutable.js";

type E2EFixtures = {
  testArtifacts: TestArtifacts;
  electronApp: ElectronApplication;
  renderer: { page: Page };
  server: {
    host: string;
    port: number;
    rpc: HaloClient;
    harness: E2ETestHarness;
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
      harness: testArtifacts.harness,
    });
  },
});

function processEnvironment() {
  // Electron treats the packaged app as a Node process when this inherited variable is present.
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[0] !== "ELECTRON_RUN_AS_NODE" && entry[1] !== undefined,
    ),
  );
}
