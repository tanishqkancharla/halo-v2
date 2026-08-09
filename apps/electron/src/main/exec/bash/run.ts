import { spawn } from "node:child_process";
import * as errore from "errore";

export class BashRunError extends errore.createTaggedError({
  name: "BashRunError",
  message: "Failed to run bash command",
}) {}

export async function runBash(
  cwd: string,
  {
    command,
    timeoutMs,
    signal,
  }: {
    command: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
) {
  if (signal?.aborted) {
    return new BashRunError({ cause: signal.reason });
  }

  return new Promise<
    { stdout: string; stderr: string; code: number | null } | BashRunError
  >((resolve) => {
    const child = spawn("bash", ["-lc", command], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (
      result:
        | { stdout: string; stderr: string; code: number | null }
        | BashRunError,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };

    const onAbort = () => {
      child.kill("SIGTERM");
      finish(new BashRunError({ cause: signal?.reason }));
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            child.kill("SIGTERM");
            finish(
              new BashRunError({
                cause: new Error(`Command timed out after ${timeoutMs}ms`),
              }),
            );
          }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      finish(new BashRunError({ cause: error }));
    });

    child.on("close", (code) => {
      finish({ stdout, stderr, code });
    });
  });
}
