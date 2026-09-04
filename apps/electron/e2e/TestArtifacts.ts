import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { HaloClient } from "@get-halo/shared/contract";
import type { ConsoleMessage, Page, Request, TestInfo } from "@playwright/test";
import * as errore from "errore";

class TestArtifactError extends errore.createTaggedError({
  name: "TestArtifactError",
  message: "Could not $operation E2E test artifacts",
}) {}

type TestFiles = {
  write(input: { path: string; content: string | Uint8Array }): Promise<void>;
  read(path: string): Promise<Buffer>;
};

type TestPaths = {
  root: string;
  workspace: string;
  userData: string;
  playwright: string;
  mainStdoutLog: string;
  mainStderrLog: string;
  rendererLog: string;
  screenshot: string;
  trace: string;
  haloLog: string;
};

export type E2ETestHarness = {
  createClient(serverHost: string, serverPort: number): HaloClient;
  files: TestFiles;
  paths: TestPaths;
};

export async function createTestArtifacts(testInfo: TestInfo) {
  const parent = path.resolve(import.meta.dirname, "../../../tmp/e2e");
  await fsPromises.mkdir(parent, { recursive: true });
  const testName = testInfo.titlePath
    .join("-")
    .replaceAll(/[^a-zA-Z0-9._-]/g, "-");
  const root = await fsPromises.mkdtemp(path.join(parent, `${testName}-`));
  const paths = {
    root,
    workspace: path.join(root, "workspace"),
    userData: path.join(root, "user-data"),
    playwright: path.join(root, "playwright"),
    mainStdoutLog: path.join(root, "main.stdout.log"),
    mainStderrLog: path.join(root, "main.stderr.log"),
    rendererLog: path.join(root, "renderer.console.log"),
    screenshot: path.join(root, "renderer.png"),
    trace: path.join(root, "trace.zip"),
    haloLog: path.join(root, "user-data", "logs", "halo.jsonl"),
  };
  await Promise.all([
    fsPromises.mkdir(paths.workspace, { recursive: true }),
    fsPromises.mkdir(paths.userData, { recursive: true }),
  ]);
  await fsPromises.writeFile(
    path.join(paths.userData, "workspace.json"),
    `${JSON.stringify({ workspaceRoot: paths.workspace })}\n`,
  );

  const outputPrefix = `[e2e:${testInfo.title}:main]`;
  const captureFinalizers: Array<() => Promise<void>> = [];

  const resolveFilePath = (filePath: string) => {
    const resolved = path.resolve(root, filePath);
    const relative = path.relative(root, resolved);
    if (relative === "..") throw new Error("Test file path escapes its root.");
    if (relative.startsWith(`..${path.sep}`)) {
      throw new Error("Test file path escapes its root.");
    }
    if (path.isAbsolute(relative)) {
      throw new Error("Test file path escapes its root.");
    }
    return resolved;
  };
  const files: TestFiles = {
    async write(input) {
      const filePath = resolveFilePath(input.path);
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      await fsPromises.writeFile(filePath, input.content);
    },
    read(filePath) {
      return fsPromises.readFile(resolveFilePath(filePath));
    },
  };
  const harness: E2ETestHarness = {
    createClient(serverHost, serverPort) {
      const link = new RPCLink({
        origin: `http://${serverHost}:${serverPort}`,
        url: "/rpc",
      });
      // SAFETY: the server host and port point to the Halo RPC contract.
      return createORPCClient(link) as HaloClient;
    },
    files,
    paths,
  };
  return {
    harness,
    paths,
    captureProcess(mainProcess: ChildProcess) {
      if (mainProcess.stdout === null || mainProcess.stderr === null) {
        return new TestArtifactError({ operation: "capture main process" });
      }
      captureFinalizers.push(
        captureProcessOutput({
          input: mainProcess.stdout,
          logPath: paths.mainStdoutLog,
          prefix: outputPrefix,
          terminal: process.stdout,
        }),
        captureProcessOutput({
          input: mainProcess.stderr,
          logPath: paths.mainStderrLog,
          prefix: outputPrefix,
          terminal: process.stderr,
        }),
      );
    },
    async captureRenderer(page: Page) {
      const initialized = await fsPromises
        .writeFile(paths.rendererLog, "")
        .catch(
          (cause) =>
            new TestArtifactError({
              operation: "initialize renderer log",
              cause,
            }),
        );
      if (initialized instanceof Error) return initialized;

      const prefix = `[e2e:${testInfo.title}:renderer]`;
      const rendererLog = createRendererLog({
        path: paths.rendererLog,
        prefix,
      });
      const onConsole = (message: ConsoleMessage) => {
        rendererLog.write(`[console:${message.type()}] ${message.text()}`);
      };
      const onPageError = (error: Error) => {
        rendererLog.write(
          `[pageerror] ${error.stack === undefined ? error.message : error.stack}`,
        );
      };
      const onRequestFailed = (request: Request) => {
        const failure = request.failure();
        const detail = failure === null ? "unknown failure" : failure.errorText;
        rendererLog.write(
          `[requestfailed] ${request.method()} ${request.url()}: ${detail}`,
        );
      };
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onRequestFailed);
      captureFinalizers.push(async () => {
        page.off("console", onConsole);
        page.off("pageerror", onPageError);
        page.off("requestfailed", onRequestFailed);
        await rendererLog.finish();
      });
    },
    async captureScreenshot(page: Page) {
      return await page
        .screenshot({ path: paths.screenshot, fullPage: true })
        .then(() => undefined)
        .catch(
          (cause) =>
            new TestArtifactError({
              operation: "capture renderer screenshot",
              cause,
            }),
        );
    },
    async finish() {
      const finalized = await Promise.all(
        captureFinalizers.map((finalize) => finalize()),
      ).catch(
        (cause) => new TestArtifactError({ operation: "finalize logs", cause }),
      );
      if (finalized instanceof Error) {
        retainArtifacts(paths.root);
        return finalized;
      }

      if (testInfo.status !== testInfo.expectedStatus) {
        const attached = await attachArtifacts({ testInfo, paths });
        retainArtifacts(paths.root);
        return attached;
      }

      const removed = await fsPromises
        .rm(paths.root, { recursive: true, force: true })
        .catch(
          (cause) =>
            new TestArtifactError({ operation: "remove passing", cause }),
        );
      if (removed instanceof Error) retainArtifacts(paths.root);
      return removed;
    },
  };
}

export type TestArtifacts = Awaited<ReturnType<typeof createTestArtifacts>>;

function captureProcessOutput(args: {
  input: NodeJS.ReadableStream;
  logPath: string;
  prefix: string;
  terminal: NodeJS.WritableStream;
}) {
  let pendingLine = "";
  let writes = fsPromises.writeFile(args.logPath, "");
  const onData = (chunk: Buffer | string) => {
    writes = writes.then(() => fsPromises.appendFile(args.logPath, chunk));
    const text = pendingLine + chunk.toString();
    const lastNewline = text.lastIndexOf("\n");
    if (lastNewline === -1) {
      pendingLine = text;
      return;
    }
    pendingLine = text.slice(lastNewline + 1);
    for (const line of text.slice(0, lastNewline).split("\n")) {
      args.terminal.write(`${args.prefix} ${line}\n`);
    }
  };
  args.input.on("data", onData);
  return async () => {
    args.input.off("data", onData);
    if (pendingLine.length > 0) {
      args.terminal.write(`${args.prefix} ${pendingLine}\n`);
    }
    await writes;
  };
}

function createRendererLog(args: { path: string; prefix: string }) {
  let writes = Promise.resolve();
  return {
    write(line: string) {
      process.stdout.write(`${args.prefix} ${line}\n`);
      writes = writes.then(() => fsPromises.appendFile(args.path, `${line}\n`));
    },
    async finish() {
      await writes;
    },
  };
}

async function attachArtifacts(args: { testInfo: TestInfo; paths: TestPaths }) {
  const attachments = [
    ["renderer screenshot", args.paths.screenshot],
    ["Playwright trace", args.paths.trace],
    ["main stdout", args.paths.mainStdoutLog],
    ["main stderr", args.paths.mainStderrLog],
    ["renderer console", args.paths.rendererLog],
    ["Halo JSONL log", args.paths.haloLog],
  ] as const;
  return await Promise.all(
    attachments
      .filter(([, filePath]) => fs.existsSync(filePath))
      .map(([name, filePath]) =>
        args.testInfo.attach(name, { path: filePath }),
      ),
  )
    .then(() => undefined)
    .catch(
      (cause) => new TestArtifactError({ operation: "attach failure", cause }),
    );
}

function retainArtifacts(root: string): void {
  console.error(`[e2e] Artifacts retained: ${root}`);
}
