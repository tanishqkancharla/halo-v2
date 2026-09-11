import fs from "node:fs/promises";
import { fork, type ChildProcess, type Serializable } from "node:child_process";
import { createInterface } from "node:readline";
import { Value } from "@sinclair/typebox/value";
import {
  userServerReadySchema,
  type UserServerConfig,
  type UserServerReady,
} from "@get-halo/server/process";
import type { Logger } from "@repo/logger";
import type { OpenAILLMApiOptions } from "@get-halo/server/llm";
import * as errore from "errore";

class UserServerProcessError extends errore.createTaggedError({
  name: "UserServerProcessError",
  message: "User-server process failed: $detail",
}) {}

export async function startUserServerProcess(ctx: {
  entry: string;
  config: UserServerConfig;
  logger: Logger;
  configPath: string;
  llmConfiguration: OpenAILLMApiOptions;
}) {
  const written = await fs
    .writeFile(ctx.configPath, JSON.stringify(ctx.config), { mode: 0o600 })
    .catch(
      (cause) =>
        new UserServerProcessError({ detail: "write configuration", cause }),
    );
  if (written instanceof Error) return written;
  const child = errore.try({
    try: () =>
      fork(ctx.entry, [ctx.configPath], {
        execArgv: ["--import", "tsx"],
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: undefined,
          HALO_LLM_CONFIG: JSON.stringify(ctx.llmConfiguration),
        },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      }),
    catch: (cause) => new UserServerProcessError({ detail: "spawn", cause }),
  });
  if (child instanceof Error) return child;
  const exited = new Promise<void | UserServerProcessError>((resolve) => {
    child.once("close", (code, signal) =>
      resolve(
        code === 0
          ? undefined
          : new UserServerProcessError({
              detail: `exited (${signal === null ? code : signal})`,
            }),
      ),
    );
  });
  // Node's fork overload does not narrow streams from the stdio configuration.
  const stdout = createInterface({ input: child.stdout! });
  const stderr = createInterface({ input: child.stderr! });
  stdout.on("line", (line: string) =>
    ctx.logger.info({ event: "user-server-stdout", line }),
  );
  stderr.on("line", (line: string) =>
    ctx.logger.warn({ event: "user-server-stderr", line }),
  );
  child.on("error", (error) =>
    ctx.logger.warn({ event: "user-server-process-error", error }),
  );
  const ready = await waitForReady(child);
  if (ready instanceof Error) {
    child.kill("SIGKILL");
    await exited;
    return ready;
  }
  return {
    ...ready,
    exited,
    isRunning: () => child.exitCode === null && child.signalCode === null,
    async close() {
      if (child.exitCode !== null || child.signalCode !== null)
        return await exited;
      using cleanup = new errore.DisposableStack();
      // Extensions or shell tools may prevent graceful shutdown from completing.
      const timeout = setTimeout(() => child.kill("SIGKILL"), 10_000);
      cleanup.defer(() => clearTimeout(timeout));
      // Windows SIGTERM kills immediately; IPC allows sessions and databases to close.
      child.send("shutdown", (cause) => {
        if (cause === null) return;
        ctx.logger.warn({
          event: "user-server-shutdown-message-failed",
          error: cause,
        });
        child.kill("SIGKILL");
      });
      return await exited;
    },
  };
}

async function waitForReady(child: ChildProcess) {
  using cleanup = new errore.DisposableStack();
  return await new Promise<UserServerReady | UserServerProcessError>(
    (resolve) => {
      const onMessage = (message: Serializable) => {
        if (Value.Check(userServerReadySchema, message)) resolve(message);
      };
      const onError = (cause: Error) =>
        resolve(new UserServerProcessError({ detail: "startup", cause }));
      const onClose = () =>
        resolve(
          new UserServerProcessError({
            detail: "exited before becoming ready",
          }),
        );
      // Startup installs integration catalogs and starts extension processes, which can stall.
      const timeout = setTimeout(
        () =>
          resolve(
            new UserServerProcessError({
              detail: "startup exceeded 60 seconds",
            }),
          ),
        60_000,
      );
      child.on("message", onMessage);
      child.once("error", onError);
      child.once("close", onClose);
      cleanup.defer(() => {
        clearTimeout(timeout);
        child.off("message", onMessage);
        child.off("error", onError);
        child.off("close", onClose);
      });
    },
  );
}
