import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { FlowstackFileError, FlowstackServeError } from "./errors.js";

type StartServerInput = {
  workspaceRoot: string;
  port: number;
  host: string;
};

const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function noop() {}

function createClosedBarrier() {
  let resolveFn = noop;
  const closed = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });
  return {
    closed,
    resolve() {
      resolveFn();
    },
  };
}

export async function startServer(input: StartServerInput) {
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const closedBarrier = createClosedBarrier();

  const vite = await createServer({
    configFile: path.join(packageRoot, "vite.config.ts"),
    root: packageRoot,
    server: {
      port: input.port,
      host: input.host,
      strictPort: input.port !== 0,
      // The page is meant to be reached through a tunnel hostname.
      allowedHosts: true,
      fs: {
        allow: [packageRoot, workspaceRoot],
      },
    },
    plugins: [
      {
        name: "flowstack-api",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === undefined || !req.url.startsWith("/__flowstack")) {
              next();
              return;
            }
            // oxlint-disable-next-line typescript/no-floating-promises -- Connect middleware callbacks cannot await response handling.
            void handleFlowstackRequest({
              url: req.url,
              workspaceRoot,
              res,
            });
          });
        },
      },
    ],
  });

  await vite.listen(input.port);
  const urls = vite.resolvedUrls;
  const localUrl = urls?.local[0];
  if (localUrl === undefined) {
    await vite.close();
    return new FlowstackServeError({ reason: "no listen url" });
  }

  async function shutdown() {
    await vite.close();
    closedBarrier.resolve();
  }
  process.once("SIGINT", () => {
    // oxlint-disable-next-line typescript/no-floating-promises -- Process signal callbacks cannot await shutdown.
    void shutdown();
  });
  process.once("SIGTERM", () => {
    // oxlint-disable-next-line typescript/no-floating-promises -- Process signal callbacks cannot await shutdown.
    void shutdown();
  });

  return { url: localUrl.replace(/\/$/, ""), closed: closedBarrier.closed };
}

type FlowstackResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk: string) => void;
};

async function handleFlowstackRequest(input: {
  url: string;
  workspaceRoot: string;
  res: FlowstackResponse;
}) {
  const parsed = new URL(input.url, "http://127.0.0.1");
  if (parsed.pathname !== "/__flowstack/file") {
    input.res.statusCode = 404;
    input.res.end("not found");
    return;
  }
  const excerpt = await readWorkspaceExcerpt({
    workspaceRoot: input.workspaceRoot,
    requestedPath: parsed.searchParams.get("path"),
    start: parsed.searchParams.get("start"),
    end: parsed.searchParams.get("end"),
  });
  input.res.setHeader("content-type", "application/json; charset=utf-8");
  if (excerpt instanceof Error) {
    input.res.statusCode = 400;
    input.res.end(JSON.stringify({ error: excerpt.message }));
    return;
  }
  input.res.statusCode = 200;
  input.res.end(JSON.stringify(excerpt));
}

async function readWorkspaceExcerpt(input: {
  workspaceRoot: string;
  requestedPath: string | null;
  start: string | null;
  end: string | null;
}) {
  if (input.requestedPath === null || input.requestedPath.length === 0) {
    return new FlowstackFileError({ path: "", reason: "missing path" });
  }
  const requestedPath = input.requestedPath;
  const resolved = path.resolve(input.workspaceRoot, requestedPath);
  const prefix = input.workspaceRoot.endsWith(path.sep)
    ? input.workspaceRoot
    : input.workspaceRoot + path.sep;
  if (!resolved.startsWith(prefix)) {
    return new FlowstackFileError({
      path: requestedPath,
      reason: "path escapes workspace",
    });
  }
  const contents = await fs.readFile(resolved, "utf8").catch(
    (cause) =>
      new FlowstackFileError({
        path: requestedPath,
        reason: "read",
        cause,
      }),
  );
  if (contents instanceof Error) return contents;
  const lines = contents.split("\n");
  const start = parseLine(input.start, 1);
  const end = parseLine(input.end, lines.length);
  return {
    path: requestedPath,
    start,
    end,
    contents: lines.slice(start - 1, end).join("\n"),
  };
}

function parseLine(value: string | null, fallback: number) {
  if (value === null || value.length === 0) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}
