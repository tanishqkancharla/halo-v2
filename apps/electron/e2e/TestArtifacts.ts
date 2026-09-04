import fs from "node:fs/promises";
import path from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { HaloClient } from "@get-halo/shared/contract";
import type { TestInfo } from "@playwright/test";

type TestFiles = {
  write(input: { path: string; content: string | Uint8Array }): Promise<void>;
  read(path: string): Promise<Buffer>;
};

type TestPaths = {
  root: string;
  workspace: string;
  userData: string;
};

export type E2ETestHarness = {
  createClient(serverHost: string, serverPort: number): HaloClient;
  files: TestFiles;
  paths: TestPaths;
};

export async function createTestArtifacts(testInfo: TestInfo) {
  const parent = path.resolve(import.meta.dirname, "../../../tmp/e2e");
  await fs.mkdir(parent, { recursive: true });
  const testName = testInfo.titlePath
    .join("-")
    .replaceAll(/[^a-zA-Z0-9._-]/g, "-");
  const root = await fs.mkdtemp(path.join(parent, `${testName}-`));
  const paths = {
    root,
    workspace: path.join(root, "workspace"),
    userData: path.join(root, "user-data"),
  };
  await Promise.all([
    fs.mkdir(paths.workspace, { recursive: true }),
    fs.mkdir(paths.userData, { recursive: true }),
  ]);
  await fs.writeFile(
    path.join(paths.userData, "workspace.json"),
    `${JSON.stringify({ workspaceRoot: paths.workspace })}\n`,
  );

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
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, input.content);
    },
    read(filePath) {
      return fs.readFile(resolveFilePath(filePath));
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
    async finish(passed: boolean) {
      if (!passed) {
        console.error(`[e2e] Artifacts retained: ${paths.root}`);
        return;
      }
      await fs.rm(paths.root, { recursive: true, force: true });
    },
  };
}

export type TestArtifacts = Awaited<ReturnType<typeof createTestArtifacts>>;
