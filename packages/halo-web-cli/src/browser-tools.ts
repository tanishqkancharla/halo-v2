import {
  createBrowserTools,
  LocalBrowserProvider,
  type BrowserToolkit,
} from "libretto-browser-tools";

const debuggerVersionUrl = "http://127.0.0.1:4445/json/version";

type DebuggerVersion = {
  webSocketDebuggerUrl: string;
};

type ConnectedTools = {
  sessionId: string;
  toolkit: BrowserToolkit;
};

export type ExecutionResult = {
  result: unknown;
  snapshotDiff: string;
  stderr: string;
  stdout: string;
};

export type SnapshotResult = {
  screenshot?: {
    base64: string;
    mimeType: "image/png";
  };
  tree: string;
};

async function connect(): Promise<ConnectedTools> {
  const response = await fetch(debuggerVersionUrl);
  const version = (await response.json()) as DebuggerVersion;
  const toolkit = createBrowserTools(new LocalBrowserProvider());
  const connection = await toolkit.tools.browser_connect.execute({
    cdpUrl: version.webSocketDebuggerUrl,
  });

  if (!connection.ok) {
    await toolkit.dispose();
    throw new Error(connection.error);
  }

  return { sessionId: connection.sessionId, toolkit };
}

async function useConnectedTools<T>(
  run: (connection: ConnectedTools) => Promise<T>,
): Promise<T> {
  const connection = await connect();
  try {
    return await run(connection);
  } finally {
    await connection.toolkit.dispose();
  }
}

export async function getStatus(): Promise<{
  message: string;
  ready: boolean;
}> {
  return await useConnectedTools(async ({ sessionId, toolkit }) => {
    const status = await toolkit.tools.browser_status.execute({ sessionId });
    if (!status.ok) {
      throw new Error(status.error);
    }
    return { message: "ready", ready: true };
  });
}

export async function execute(source: string): Promise<ExecutionResult> {
  return await useConnectedTools(async ({ sessionId, toolkit }) => {
    const execution = await toolkit.tools.browser_exec.execute({
      code: source,
      sessionId,
    });
    if (!execution.ok) {
      throw new Error(execution.error);
    }
    return {
      result: execution.result,
      snapshotDiff: execution.snapshotDiff,
      stderr: execution.stderr,
      stdout: execution.stdout,
    };
  });
}

export async function snapshot(screenshot: boolean): Promise<SnapshotResult> {
  return await useConnectedTools(async ({ sessionId, toolkit }) => {
    const result = await toolkit.tools.browser_snapshot.execute({
      screenshot,
      sessionId,
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    return { screenshot: result.screenshot, tree: result.tree };
  });
}
