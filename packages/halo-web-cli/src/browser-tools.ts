import {
  createBrowserToolsForPage,
  type BorrowedPageBrowserToolkit,
} from "libretto-browser-tools";
import * as errore from "errore";
import { chromium, type Browser } from "playwright";

const debuggerVersionUrl = "http://127.0.0.1:4445/json/version";

export class BrowserToolsError extends errore.createTaggedError({
  name: "BrowserToolsError",
  message: "Browser tools failed: $reason",
}) {}

type DebuggerVersion = {
  webSocketDebuggerUrl: string;
};

type ConnectedTools = {
  browser: Browser;
  sessionId: string;
  toolkit: BorrowedPageBrowserToolkit;
};

type ExecutionResult = {
  result: unknown;
  snapshotDiff: string;
  stderr: string;
  stdout: string;
};

type SnapshotResult = {
  screenshot?: {
    base64: string;
    mimeType: "image/png";
  };
  tree: string;
};

async function connectOverCdp(cdpUrl: string) {
  // Playwright defaults to prefers-color-scheme: light on CDP attach.
  // Halo follows the system theme, so that override flashes the window.
  const browser = await chromium
    .connectOverCDP(cdpUrl, { noDefaults: true })
    .catch(
      (e) =>
        new BrowserToolsError({
          reason: "Failed to attach to debugger",
          cause: e,
        }),
    );
  if (browser instanceof Error) return browser;

  const context = browser.contexts()[0];
  if (context === undefined) {
    await browser.close();
    return new BrowserToolsError({ reason: "Debugger has no browser context" });
  }

  const page = context.pages().at(-1);
  if (page === undefined) {
    await browser.close();
    return new BrowserToolsError({ reason: "Debugger has no open pages" });
  }

  const toolkit = createBrowserToolsForPage(page);
  return { browser, sessionId: toolkit.sessionId, toolkit };
}

async function connect() {
  const response = await fetch(debuggerVersionUrl).catch(
    (e) =>
      new BrowserToolsError({
        reason: "Debugger unreachable",
        cause: e,
      }),
  );
  if (response instanceof Error) return response;

  const version =
    await // SAFETY: CDP /json/version returns DebuggerVersion JSON.
    (response.json() as Promise<DebuggerVersion>).catch(
      (e) =>
        new BrowserToolsError({
          reason: "Invalid debugger version response",
          cause: e,
        }),
    );
  if (version instanceof Error) return version;

  return await connectOverCdp(version.webSocketDebuggerUrl);
}

async function useConnectedTools<T>(
  run: (connection: ConnectedTools) => Promise<BrowserToolsError | T>,
) {
  const connection = await connect();
  if (connection instanceof Error) return connection;

  await using cleanup = new errore.AsyncDisposableStack();
  cleanup.defer(() => connection.browser.close());
  cleanup.defer(() => connection.toolkit.dispose());
  return await run(connection);
}

export async function getStatus() {
  return await useConnectedTools(async ({ sessionId, toolkit }) => {
    const status = await toolkit.tools.browser_status.execute({ sessionId });
    if (!status.ok) return new BrowserToolsError({ reason: status.error });
    return { message: "ready", ready: true };
  });
}

export async function execute(source: string) {
  return await useConnectedTools(async ({ sessionId, toolkit }) => {
    const execution = await toolkit.tools.browser_exec.execute({
      code: source,
      sessionId,
    });
    if (!execution.ok)
      return new BrowserToolsError({ reason: execution.error });
    return {
      result: execution.result,
      snapshotDiff: execution.snapshotDiff,
      stderr: execution.stderr,
      stdout: execution.stdout,
    } satisfies ExecutionResult;
  });
}

export async function snapshot(screenshot: boolean) {
  return await useConnectedTools(async ({ sessionId, toolkit }) => {
    const result = await toolkit.tools.browser_snapshot.execute({
      screenshot,
      sessionId,
    });
    if (!result.ok) return new BrowserToolsError({ reason: result.error });
    return {
      screenshot: result.screenshot,
      tree: result.tree,
    } satisfies SnapshotResult;
  });
}
