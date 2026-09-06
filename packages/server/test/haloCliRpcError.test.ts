import { execFile, type ExecFileException } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { serverTest } from "./serverTest.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const cliPath = join(repoRoot, "packages", "halo-cli", "src", "cli.ts");
const execFileP = promisify(execFile);

serverTest(
  "halo CLI reports RPC failures and serves the happy path through the real binary",
  async ({ server }) => {
    const dir = await mkdtemp(join(tmpdir(), "halo-cli-e2e-"));
    try {
      const rpcFile = join(dir, "rpc.json");
      await writeFile(
        rpcFile,
        `${JSON.stringify({
          version: 1,
          host: server.host,
          port: server.port,
          token: server.token,
        })}\n`,
      );

      const invalid = await runHalo(["plugin", "new", "1bad"], rpcFile);
      expect(invalid.status).toBe(1);
      expect(invalid.output).toContain(
        "RPC call failed: Plugin id '1bad' is invalid: must match [a-z][a-z0-9-]*",
      );
      expect(invalid.output).not.toContain("Failed to read rpc.json:");

      const status = await runHalo(["status"], rpcFile);
      expect(status.status).toBe(0);
      expect(status.output).toContain("127.0.0.1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  30_000,
);

async function runHalo(args: string[], rpcFile: string) {
  try {
    const { stdout, stderr } = await execFileP(
      process.execPath,
      ["--import", "tsx", cliPath, ...args],
      {
        cwd: repoRoot,
        env: { ...process.env, HALO_RPC_FILE: rpcFile },
        timeout: 20_000,
        maxBuffer: 10_000_000,
      },
    );
    return { status: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    // SAFETY: execFile rejects with an ExecFileException carrying the child's captured stdout and stderr.
    const e = error as ExecFileException;
    return { status: 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}
