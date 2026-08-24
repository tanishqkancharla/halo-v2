import {
  createBrowserTools,
  LocalBrowserProvider,
  type BrowserToolkit,
} from "libretto-browser-tools";
import * as errore from "errore";

const debuggerVersionUrl = "http://127.0.0.1:4445/json/version";

export class BrowserToolsError extends errore.createTaggedError({
  name: "BrowserToolsError",
  message: "Browser tools failed: $reason",
}) {}

type DebuggerVersion = {
  webSocketDebuggerUrl: string;
};

type ConnectedTools = {
  sessionId: string;
  toolkit: BrowserToolkit;
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

  const toolkit = createBrowserTools(new LocalBrowserProvider());
  const connection = await toolkit.tools.browser_connect.execute({
    cdpUrl: version.webSocketDebuggerUrl,
  });

  if (!connection.ok) {
    await toolkit.dispose();
    return new BrowserToolsError({ reason: connection.error });
  }

  return { sessionId: connection.sessionId, toolkit };
}

async function useConnectedTools<T>(
  run: (connection: ConnectedTools) => Promise<BrowserToolsError | T>,
) {
  const connection = await connect();
  if (connection instanceof Error) return connection;

  await using cleanup = new errore.AsyncDisposableStack();
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
