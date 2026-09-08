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

serverTest(
  "serves each workspace independently in the same process",
  { timeout: 20_000 },
  async ({ server, startServer }) => {
    const otherRoot = path.join(server.harness.paths.root, "other-workspace");
    await fs.mkdir(otherRoot);
    const originalPath = process.env.PATH;
    const other = await startServer(otherRoot);

    await server.rpc.workspace.writeFile({
      path: "notes.md",
      content: "First workspace",
    });
    await other.rpc.workspace.writeFile({
      path: "notes.md",
      content: "Second workspace",
    });

    expect(await server.rpc.workspace.get()).toMatchObject({
      workspaceRoot: server.harness.paths.workspace,
    });
    expect(await other.rpc.workspace.get()).toMatchObject({
      workspaceRoot: otherRoot,
    });
    expect(await server.rpc.workspace.readFile({ path: "notes.md" })).toBe(
      "First workspace",
    );
    expect(await other.rpc.workspace.readFile({ path: "notes.md" })).toBe(
      "Second workspace",
    );
    expect(process.env.PATH).toBe(originalPath);
    expect(await fs.readdir(server.harness.paths.userData)).not.toContain(
      "workspace.json",
    );
  },
);

for (const failure of [
  {
    name: "tool runtime",
    path: ".halo/executor/metadata.sqlite",
    error: "Tool runtime failed during startup",
  },
  {
    name: "workspace preparation",
    path: ".agents",
    error: "Failed to seed workspace extension guidance",
  },
]) {
  serverTest(
    `releases startup resources after ${failure.name} fails`,
    { timeout: 20_000 },
    async ({ server, startServer }) => {
      const workspaceRoot = path.join(
        server.harness.paths.root,
        "startup-workspace",
      );
      const blockedPath = path.join(workspaceRoot, failure.path);
      await server.harness.files.write({
        path: blockedPath,
        content: "invalid",
      });
      await server.close();

      await expect(startServer(workspaceRoot, server.port)).rejects.toThrow(
        failure.error,
      );

      await fs.rm(blockedPath);
      const restarted = await startServer(workspaceRoot, server.port);
      await restarted.rpc.workspace.writeFile({
        path: "notes.md",
        content: "Ready after repair",
      });
      expect(await restarted.rpc.workspace.readFile({ path: "notes.md" })).toBe(
        "Ready after repair",
      );
    },
  );
}

serverTest(
  "creates folders and moves their contents without overwriting files",
  async ({ server }) => {
    await server.rpc.workspace.createEntry({
      path: "Notes",
      kind: "directory",
    });
    await server.rpc.workspace.createEntry({
      path: "Archive",
      kind: "directory",
    });
    await server.rpc.workspace.createEntry({
      path: "Notes/Today.md",
      kind: "file",
    });
    await server.rpc.workspace.writeFile({
      path: "Notes/Today.md",
      content: "Keep this note",
    });
    await server.rpc.workspace.moveEntry({
      source: "Notes/Today.md",
      destination: "Notes/Plan.md",
    });
    await server.rpc.workspace.moveEntry({
      source: "Notes",
      destination: "Archive/Notes",
    });
    expect(
      await server.rpc.workspace.readFile({ path: "Archive/Notes/Plan.md" }),
    ).toBe("Keep this note");
    expect(await server.rpc.workspace.listPaths()).toEqual([
      "Archive/Notes/Plan.md",
    ]);

    await expect(
      server.rpc.workspace.createEntry({
        path: "Archive/Notes/Plan.md",
        kind: "file",
      }),
    ).rejects.toThrow("already exists");
    await server.rpc.workspace.createEntry({ path: "Other.md", kind: "file" });
    await expect(
      server.rpc.workspace.moveEntry({
        source: "Other.md",
        destination: "Archive/Notes/Plan.md",
      }),
    ).rejects.toThrow("already exists");
    expect(
      await server.rpc.workspace.readFile({ path: "Archive/Notes/Plan.md" }),
    ).toBe("Keep this note");
    await expect(
      server.rpc.workspace.moveEntry({
        source: "Archive",
        destination: "Archive/Notes/Nested",
      }),
    ).rejects.toThrow("cannot be moved into itself");
  },
);

serverTest(
  "keeps file management inside the visible workspace",
  async ({ server }) => {
    for (const invalid of [
      "../outside.md",
      ".pi/secret.md",
      "node_modules/new.md",
      "",
    ]) {
      await expect(
        server.rpc.workspace.createEntry({ path: invalid, kind: "file" }),
      ).rejects.toThrow("not a workspace file");
    }
    const outside = path.join(server.harness.paths.root, "outside");
    await fs.mkdir(outside);
    await fs.symlink(
      outside,
      path.join(server.harness.paths.workspace, "Shortcut"),
      "junction",
    );
    await expect(
      server.rpc.workspace.createEntry({
        path: "Shortcut/file.md",
        kind: "file",
      }),
    ).rejects.toThrow("not a workspace file");
    expect(await fs.readdir(outside)).toEqual([]);
  },
);

serverTest(
  "renames a note when only capitalization changes",
  async ({ server }) => {
    await server.rpc.workspace.writeFile({
      path: "notes.md",
      content: "Keep my note",
    });
    await server.rpc.workspace.moveEntry({
      source: "notes.md",
      destination: "Notes.md",
    });
    expect(await server.rpc.workspace.listPaths()).toEqual(["Notes.md"]);
    expect(await server.rpc.workspace.readFile({ path: "Notes.md" })).toBe(
      "Keep my note",
    );
  },
);

serverTest(
  "deletes files and folders while preserving neighboring files",
  async ({ server }) => {
    await server.rpc.workspace.writeFile({
      path: "Notes/Today.txt",
      content: "remove",
    });
    await server.rpc.workspace.writeFile({ path: "Keep.txt", content: "keep" });
    await server.rpc.workspace.deleteEntry({ path: "Notes/Today.txt" });
    expect(await server.rpc.workspace.listPaths()).toEqual([
      "Keep.txt",
      "Notes/",
    ]);
    await server.rpc.workspace.writeFile({
      path: "Notes/Nested/Plan.txt",
      content: "remove",
    });
    await server.rpc.workspace.deleteEntry({ path: "Notes" });
    expect(await server.rpc.workspace.listPaths()).toEqual(["Keep.txt"]);
    for (const invalid of ["", "../outside", ".pi"]) {
      await expect(
        server.rpc.workspace.deleteEntry({ path: invalid }),
      ).rejects.toThrow("not a workspace file");
    }
    expect(await server.rpc.workspace.readFile({ path: "Keep.txt" })).toBe(
      "keep",
    );
  },
);
