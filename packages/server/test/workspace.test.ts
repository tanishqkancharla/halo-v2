import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";
import type { WorkspaceTreeEvent } from "@get-halo/shared/rpc";
import { serverTest } from "./serverTest.js";

serverTest("reads, writes, and lists workspace files", async ({ server }) => {
  expect(await server.rpc.workspace.get()).toMatchObject({
    workspaceRoot: server.harness.paths.workspace,
  });

  await server.rpc.workspace.writeFile({
    path: "notes/today.md",
    content: "# Today",
  });
  await server.harness.files.write({
    path: path.join(server.harness.paths.workspace, ".hidden", "secret.txt"),
    content: "secret",
  });

  expect(await server.rpc.workspace.readFile({ path: "notes/today.md" })).toBe(
    "# Today",
  );
  expect(await server.rpc.workspace.listPaths()).toEqual(["notes/today.md"]);
});

serverTest("rejects files outside the public workspace", async ({ server }) => {
  await expect(
    server.rpc.workspace.writeFile({
      path: ".env",
      content: "SECRET=1",
    }),
  ).rejects.toThrow("'.env' is not a workspace file");
  await expect(
    server.rpc.workspace.writeFile({
      path: "../outside.txt",
      content: "outside",
    }),
  ).rejects.toThrow("'../outside.txt' is not a workspace file");
  await expect(
    server.rpc.workspace.readFile({ path: "../outside.txt" }),
  ).rejects.toThrow("'../outside.txt' is not a workspace file");
});

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

serverTest(
  "surfaces contents of a populated directory moved into the workspace",
  async ({ server }) => {
    const workspace = server.harness.paths.workspace;
    // Build the populated directory outside the workspace (same filesystem,
    // so the move is an atomic rename that parcel coalesces into a single
    // directory create on Linux/inotify — the exact trigger for the bug).
    const src = path.join(server.harness.paths.root, "imported-src");
    await fs.mkdir(path.join(src, "deep"), { recursive: true });
    await fs.writeFile(path.join(src, "in.txt"), "x");
    await fs.writeFile(path.join(src, "deep", "note.md"), "y");

    // Subscribe before the move so we observe the create events.
    const controller = new AbortController();
    const eventStream = await server.rpc.workspace.events(undefined, {
      signal: controller.signal,
    });
    const collected: WorkspaceTreeEvent[] = [];
    const consume = (async () => {
      for await (const batch of eventStream) {
        for (const event of batch) collected.push(event);
      }
    })();

    try {
      await fs.rename(src, path.join(workspace, "imported"));

      // The fix enumerates the new directory's contents, so the contained
      // files reach the tree stream rather than leaving an empty folder.
      await waitFor(() =>
        collected.some((event) => event.path === "imported/deep/note.md"),
      );

      expect(collected).toEqual(
        expect.arrayContaining([
          { type: "create", path: "imported/" },
          { type: "create", path: "imported/in.txt" },
          { type: "create", path: "imported/deep/note.md" },
        ]),
      );

      // The on-demand list is consistent with the live stream.
      const listed = await server.rpc.workspace.listPaths();
      expect(listed).toEqual(
        expect.arrayContaining(["imported/in.txt", "imported/deep/note.md"]),
      );
    } finally {
      controller.abort();
      await consume.catch(() => undefined);
    }
  },
);
