import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import { type RouterClient } from "@orpc/server";
import * as esbuild from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MessageChannel, Worker } from "node:worker_threads";
import { describe, expect, test } from "vitest";
import { type ExtensionHostRouter } from "./plugins/extensionHostRouter.js";

type HostClient = RouterClient<ExtensionHostRouter>;

const entry = fileURLToPath(new URL("./extensionHostMain.ts", import.meta.url));

const hostTest = test.extend<{
  bundledHost: string;
}>({
  bundledHost: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-host-${task.id}-`));
    const outfile = join(directory, "extensionHost.cjs");
    await esbuild.build({
      absWorkingDir: directory,
      entryPoints: [entry],
      bundle: true,
      write: true,
      outfile,
      format: "cjs",
      platform: "node",
    });
    await use(outfile);
    await rm(directory, { recursive: true, force: true });
  },
});

describe("extensionHostMain", () => {
  hostTest("answers ping from a Worker", async ({ bundledHost }) => {
    const worker = new Worker(pathToFileURL(bundledHost));
    const { port1, port2 } = new MessageChannel();
    worker.postMessage({ port: port1 }, [port1]);
    const client: HostClient = createORPCClient(new RPCLink({ port: port2 }));
    port2.start();
    expect(await client.ping()).toEqual({ ok: true });
    await worker.terminate();
    port2.close();
  });
});
