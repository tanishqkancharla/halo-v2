import path from "node:path";
import outdent from "outdent";
import { expect } from "vitest";
import { FilesystemService } from "../src/filesystem/FilesystemService.js";
import { serverTest } from "./serverTest.js";

serverTest(
  "preserves a grant against a concurrent interleaving invoke",
  async ({ server }) => {
    await server.rpc.workspace.writeFile({
      path: "message.txt",
      content: "hello",
    });

    const writePluginSource = async (directory: string) => {
      const packagePath = path.join(directory, "package.json");
      // SAFETY: plugins.create writes a package object with a Halo manifest.
      const packageJson = JSON.parse(
        (await server.harness.files.read(packagePath)).toString("utf8"),
      ) as { halo: { capabilities?: string[] } };
      packageJson.halo.capabilities = ["files.read"];
      await server.harness.files.write({
        path: packagePath,
        content: `${JSON.stringify(packageJson, undefined, 2)}\n`,
      });
      await server.harness.files.write({
        path: path.join(directory, "server.ts"),
        content: outdent`
          import { pluginOs } from "@get-halo/plugin-sdk/server";

          export default {
            read: pluginOs.handler(({ context }) =>
              context.tools.files.read({ path: "message.txt" }),
            ),
          };
        `,
      });
    };

    const alpha = await server.rpc.plugins.create({ id: "alpha" });
    const beta = await server.rpc.plugins.create({ id: "beta" });
    await writePluginSource(alpha.directory);
    await writePluginSource(beta.directory);
    await server.rpc.plugins.build();

    const grantsPath = path.join(
      server.harness.paths.workspace,
      ".halo",
      "pluginGrants.json",
    );
    const gate = gatedGrantsWrites(grantsPath);
    try {
      const grantFuture = server.rpc.plugins.grant({ pluginId: "alpha" });
      await gate.arrived(0);
      gate.release(0);
      await gate.completed(0);

      await gate.arrived(1);
      const invokeFuture = server.rpc.plugins.invoke({
        pluginId: "beta",
        path: ["read"],
        input: undefined,
      });
      // On the buggy code, invoke(beta)'s authorize->reconcile reads the
      // current file (alpha not yet granted) and reaches its gated write
      // before grant(alpha)'s grant-step write is released. On the fixed
      // code invoke(beta) is queued behind the write lock, so its arrival
      // only happens once grant-step completes; a short bounded wait keeps
      // the regression orchestration deterministic without hanging.
      await Promise.race([gate.arrived(2), wait(50)]);
      gate.release(1);
      await gate.completed(1);

      await gate.arrived(2);
      gate.release(2);
      await gate.completed(2);

      await grantFuture;
      await invokeFuture;
    } finally {
      gate.restore();
    }

    // SAFETY: PluginToolGrants writes a JSON PluginToolGrantState.
    const state = JSON.parse(
      (await server.harness.files.read(grantsPath)).toString("utf8"),
    ) as {
      plugins: Record<string, { observed: string[]; granted: string[] }>;
    };
    expect(state.plugins["alpha"]?.granted ?? []).toContain("files.read");

    const invokeAlpha = await server.rpc.plugins.invoke({
      pluginId: "alpha",
      path: ["read"],
      input: undefined,
    });
    expect(invokeAlpha).toEqual({
      ok: true,
      data: { path: "message.txt", text: "hello" },
    });
  },
  30_000,
);

type GatedWrites = {
  arrived(index: number): Promise<void>;
  completed(index: number): Promise<void>;
  release(index: number): void;
  restore(): void;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gatedGrantsWrites(grantsPath: string): GatedWrites {
  const original = FilesystemService.prototype.writeFile;
  const arrival: Array<((value: void) => void) | undefined> = [];
  const release: Array<((value: void) => void) | undefined> = [];
  const completion: Array<((value: void) => void) | undefined> = [];
  const arrivalPromises: Promise<void>[] = [];
  const releasePromises: Promise<void>[] = [];
  const completionPromises: Promise<void>[] = [];
  for (let i = 0; i < 3; i += 1) {
    arrivalPromises.push(
      new Promise<void>((resolve) => {
        arrival[i] = resolve;
      }),
    );
    releasePromises.push(
      new Promise<void>((resolve) => {
        release[i] = resolve;
      }),
    );
    completionPromises.push(
      new Promise<void>((resolve) => {
        completion[i] = resolve;
      }),
    );
  }
  let counter = 0;

  FilesystemService.prototype.writeFile = async function (
    this: FilesystemService,
    filePath: string,
    data: string | Uint8Array,
    options?: BufferEncoding | { mode?: number },
  ) {
    if (filePath === grantsPath && counter < 3) {
      const index = counter;
      counter += 1;
      arrival[index]?.();
      await releasePromises[index];
      const result = await original.call(this, filePath, data, options);
      completion[index]?.();
      return result;
    }
    return original.call(this, filePath, data, options);
  };

  return {
    async arrived(index: number) {
      await arrivalPromises[index];
    },
    async completed(index: number) {
      await completionPromises[index];
    },
    release(index: number) {
      release[index]?.();
    },
    restore() {
      FilesystemService.prototype.writeFile = original;
    },
  };
}
