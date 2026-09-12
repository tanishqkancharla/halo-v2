import { createHaloRpcClient, readHaloRpcFile, rpcFilePath } from "@halo/cli";
import type { HaloClient } from "@get-halo/shared/contract";
import * as errore from "errore";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";
import type { TestArtifacts } from "./TestArtifacts.js";
import { resolveUnpackedExecutable } from "./resolveUnpackedExecutable.js";

type RunningApp = {
  electron: ElectronApplication;
  page: Page;
  server: { host: string; port: number; rpc: HaloClient };
  resources: errore.AsyncDisposableStack;
};

export class ElectronTestApp {
  private current: RunningApp | undefined;
  constructor(private readonly artifacts: TestArtifacts) {}

  get page() {
    return this.running.page;
  }

  get server() {
    return this.running.server;
  }

  async open() {
    if (this.current !== undefined) {
      throw new Error(
        "Halo is already open. Call app.quit() before reopening.",
      );
    }
    await using resources = new errore.AsyncDisposableStack();
    const executablePath = resolveUnpackedExecutable();
    if (executablePath instanceof Error) throw executablePath;
    const launch = this.artifacts.createLaunch();
    const electronApp = await electron.launch({
      executablePath,
      args: [`--user-data-dir=${this.artifacts.paths.userData}`],
      artifactsDir: this.artifacts.paths.playwright,
      env: {
        ...processEnvironment(),
        HALO_E2E: "1",
        HALO_USER_DATA: this.artifacts.paths.userData,
      },
    });
    resources.defer(async () => await electronApp.close());
    const captured = this.artifacts.captureProcess(
      electronApp.process(),
      launch,
    );
    if (captured instanceof Error) throw captured;
    await electronApp
      .context()
      .tracing.start({ screenshots: true, snapshots: true });
    resources.defer(
      async () =>
        await electronApp.context().tracing.stop({ path: launch.trace }),
    );
    const page = await electronApp.firstWindow();
    const rendererCaptured = await this.artifacts.captureRenderer(page);
    if (rendererCaptured instanceof Error) throw rendererCaptured;
    resources.defer(async () => {
      const screenshot = await this.artifacts.captureScreenshot(page, launch);
      if (screenshot instanceof Error) throw screenshot;
    });
    const connection = await readHaloRpcFile(
      rpcFilePath(this.artifacts.paths.userData),
    );
    if (connection instanceof Error) throw connection;
    this.current = {
      electron: electronApp,
      page,
      server: {
        host: connection.host,
        port: connection.port,
        rpc: createHaloRpcClient<HaloClient>(connection),
      },
      resources: resources.move(),
    };
  }

  async quit() {
    const current = this.current;
    if (current === undefined) return;
    this.current = undefined;
    await current.resources.disposeAsync();
  }

  async openWindow() {
    const electronApp = this.running.electron;
    const opened = electronApp.waitForEvent("window");
    await electronApp.evaluate(({ app }) => app.emit("halo:e2e:open-window"));
    const page = await opened;
    const captured = await this.artifacts.captureRenderer(page);
    if (captured instanceof Error) throw captured;
    return page;
  }

  private get running(): RunningApp {
    if (this.current === undefined) {
      throw new Error("Halo is closed. Call app.open() before using it.");
    }
    return this.current;
  }
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
