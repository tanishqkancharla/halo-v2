import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { WalkthroughFileError, WalkthroughServeError } from "./errors.js";
import {
  extractFences,
  extractTitle,
  filesFromFences,
  mergeWalkthroughFiles,
} from "./extractWalkthrough.js";
import { readGitFiles } from "./gitFiles.js";

export type WalkthroughServer = {
  url: string;
  mdxPath: string;
  shutdown: () => Promise<void>;
  closed: Promise<void>;
};

export type StartWalkthroughServerInput = {
  mdxPath: string;
  workspaceRoot: string;
  port: number;
  gitBase?: string;
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

export async function startWalkthroughServer(
  input: StartWalkthroughServerInput,
) {
  const mdxPath = path.resolve(input.mdxPath);
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const mdx = await fs.readFile(mdxPath, "utf8").catch(
    (cause) =>
      new WalkthroughFileError({
        path: mdxPath,
        reason: "read",
        cause,
      }),
  );
  if (mdx instanceof Error) return mdx;

  process.env.WALKTHROUGH_MDX = mdxPath;
  process.env.WALKTHROUGH_ROOT = workspaceRoot;

  const title = extractTitle(mdx);
  const fenceFiles = filesFromFences(extractFences(mdx));
  const gitFiles = await readGitFiles(workspaceRoot, input.gitBase);
  const files = mergeWalkthroughFiles(gitFiles, fenceFiles);

  let vite: ViteDevServer | undefined;
  const closedBarrier = createClosedBarrier();
  let shuttingDown = false;

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    if (vite !== undefined) await vite.close();
    closedBarrier.resolve();
  }

  vite = await createServer({
    configFile: path.join(packageRoot, "vite.config.ts"),
    root: packageRoot,
    server: {
      port: input.port,
      host: "127.0.0.1",
      strictPort: input.port !== 0,
      fs: {
        allow: [packageRoot, workspaceRoot, path.dirname(mdxPath)],
      },
    },
    plugins: [
      {
        name: "walkthrough-api",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url;
            if (url === undefined || !url.startsWith("/__walkthrough")) {
              next();
              return;
            }
            void handleWalkthroughRequest({
              url,
              method: req.method === undefined ? "GET" : req.method,
              workspaceRoot,
              title,
              files,
              shutdown,
              res,
            });
          });
        },
      },
    ],
  });

  await vite.listen(input.port);
  const localUrl = vite.resolvedUrls?.local[0];
  if (localUrl === undefined) {
    await shutdown();
    return new WalkthroughServeError({ reason: "no listen url" });
  }

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });

  return {
    url: localUrl.replace(/\/$/, ""),
    mdxPath,
    shutdown,
    closed: closedBarrier.closed,
  };
}

type WalkthroughResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk: string) => void;
};

async function handleWalkthroughRequest(input: {
  url: string;
  method: string;
  workspaceRoot: string;
  title: string;
  files: ReturnType<typeof mergeWalkthroughFiles>;
  shutdown: () => Promise<void>;
  res: WalkthroughResponse;
}) {
  const parsed = new URL(input.url, "http://127.0.0.1");
  if (
    parsed.pathname === "/__walkthrough/shutdown" &&
    input.method === "POST"
  ) {
    input.res.statusCode = 200;
    input.res.setHeader("content-type", "text/plain; charset=utf-8");
    input.res.end("ok");
    setTimeout(() => {
      void input.shutdown();
    }, 250);
    return;
  }
  if (parsed.pathname === "/__walkthrough/meta" && input.method === "GET") {
    input.res.statusCode = 200;
    input.res.setHeader("content-type", "application/json; charset=utf-8");
    input.res.end(JSON.stringify({ title: input.title, files: input.files }));
    return;
  }
  if (parsed.pathname === "/__walkthrough/file" && input.method === "GET") {
    const excerpt = await readWorkspaceExcerpt({
      workspaceRoot: input.workspaceRoot,
      requestedPath: parsed.searchParams.get("path"),
      start: parsed.searchParams.get("start"),
      end: parsed.searchParams.get("end"),
    });
    if (excerpt instanceof Error) {
      input.res.statusCode = 400;
      input.res.setHeader("content-type", "application/json; charset=utf-8");
      input.res.end(JSON.stringify({ error: excerpt.message }));
      return;
    }
    input.res.statusCode = 200;
    input.res.setHeader("content-type", "application/json; charset=utf-8");
    input.res.end(JSON.stringify(excerpt));
    return;
  }
  input.res.statusCode = 404;
  input.res.end("not found");
}

export type FileExcerpt = {
  path: string;
  start: number;
  end: number;
  contents: string;
};

async function readWorkspaceExcerpt(input: {
  workspaceRoot: string;
  requestedPath: string | null;
  start: string | null;
  end: string | null;
}) {
  if (input.requestedPath === null || input.requestedPath.length === 0) {
    return new WalkthroughFileError({
      path: "",
      reason: "missing path",
    });
  }
  const requestedPath = input.requestedPath;
  const resolvedRoot = path.resolve(input.workspaceRoot);
  const resolved = path.resolve(resolvedRoot, requestedPath);
  const prefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;
  if (resolved !== resolvedRoot && !resolved.startsWith(prefix)) {
    return new WalkthroughFileError({
      path: requestedPath,
      reason: "path escapes workspace",
    });
  }
  const contents = await fs.readFile(resolved, "utf8").catch(
    (cause) =>
      new WalkthroughFileError({
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
