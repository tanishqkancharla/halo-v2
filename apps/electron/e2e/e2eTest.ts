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
    await artifacts.finish(testInfo.status === testInfo.expectedStatus);
  },
  electronApp: async ({ testArtifacts }, use) => {
    await using cleanup = new errore.AsyncDisposableStack();
    const executablePath = resolveUnpackedExecutable();
    if (executablePath instanceof Error) throw executablePath;
    const app = await electron.launch({
      executablePath,
      args: [`--user-data-dir=${testArtifacts.paths.userData}`],
      artifactsDir: pathForPlaywrightArtifacts(testArtifacts),
      env: {
        ...processEnvironment(),
        HALO_E2E: "1",
      },
    });
    cleanup.defer(() => app.close());
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

function pathForPlaywrightArtifacts(artifacts: TestArtifacts) {
  return `${artifacts.paths.root}/playwright`;
}
