import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";
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
  await server.harness.files.write({
    path: path.join(server.harness.paths.workspace, ".git", "config"),
    content: "repository",
  });
  await server.harness.files.write({
    path: path.join(server.harness.paths.workspace, "node_modules", "pkg.js"),
    content: "dependency",
  });
  await server.harness.files.write({
    path: path.join(server.harness.paths.workspace, "src", ".cache", "x"),
    content: "cache",
  });

  expect(await server.rpc.workspace.readFile({ path: "notes/today.md" })).toBe(
    "# Today",
  );
  expect(await server.rpc.workspace.listPaths()).toEqual([
    "notes/today.md",
    "src/",
  ]);
});

serverTest(
  "publishes workspace file creates and deletes while ignoring updates and hidden files",
  async ({ server }) => {
    const events = await server.rpc.workspace.events();
    const initial = events.next();
    await server.harness.files.write({
      path: path.join(server.harness.paths.workspace, "src", "existing.ts"),
      content: "original",
    });
    await expect(initial).resolves.toEqual({
      done: false,
      value: [
        { type: "create", path: "src/" },
        { type: "create", path: "src/existing.ts" },
      ],
    });
    await server.rpc.workspace.listPaths();

    const created = events.next();
    await server.harness.files.write({
      path: path.join(server.harness.paths.workspace, "src", "created.ts"),
      content: "created",
    });
    await expect(created).resolves.toEqual({
      done: false,
      value: [{ type: "create", path: "src/created.ts" }],
    });

    const deleted = events.next();
    await server.harness.files.write({
      path: path.join(server.harness.paths.workspace, "src", "created.ts"),
      content: "updated",
    });
    await server.harness.files.write({
      path: path.join(server.harness.paths.workspace, ".hidden", "ignored.ts"),
      content: "ignored",
    });
    await fs.rm(
      path.join(server.harness.paths.workspace, "src", "existing.ts"),
    );
    await expect(deleted).resolves.toEqual({
      done: false,
      value: [{ type: "delete", path: "src/existing.ts" }],
    });

    await events.return();
  },
);

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

serverTest("disables the tool bridge outside E2E runs", async ({ server }) => {
  await expect(
    server.rpc.testHarness.invokeTool({
      path: "files.write",
      input: { path: "notes.md", content: "This must not be written" },
    }),
  ).rejects.toThrow("The testing API is unavailable outside an E2E run.");
});
