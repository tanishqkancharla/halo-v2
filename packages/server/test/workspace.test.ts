import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";
import { contentText } from "@earendil-works/pi-ai";
import type { HaloClient } from "@get-halo/shared/contract";
import { m } from "@get-halo/shared/testing";
import { serverTest } from "./serverTest.js";

serverTest(
  "lists saved conversations during overlapping requests and a pending response",
  async ({ server, llm }) => {
    const saved = await server.rpc.sessions.create();
    const save = server.rpc.sessions.prompt({
      ...saved,
      text: "Saved conversation",
    });
    await llm.respond(m.assistant("Saved answer."));
    await save;
    await server.rpc.sessions.close(saved);

    const active = await server.rpc.sessions.create();
    const answer = server.rpc.sessions.prompt({
      ...active,
      text: "Active conversation",
    });
    await llm.waitForRequest();

    const [firstListing, secondListing] = await Promise.all([
      server.rpc.sessions.list(),
      server.rpc.sessions.list(),
      server.rpc.sessions.open(saved),
    ]);
    for (const listing of [firstListing, secondListing]) {
      expect(
        listing.map(({ sessionId, title }) => ({ sessionId, title })),
      ).toEqual(
        expect.arrayContaining([
          { ...saved, title: "Saved conversation" },
          { ...active, title: "Active conversation" },
        ]),
      );
    }

    await llm.respond(m.assistant("Active answer completed."));
    await answer;
  },
);

serverTest(
  "continues each conversation with its own history after restarting the server",
  async ({ server, llm }) => {
    const notebook = await server.rpc.sessions.create();
    const saveNotebook = server.rpc.sessions.prompt({
      ...notebook,
      text: "Blue notebook",
    });
    await llm.respond(m.assistant("Saved the notebook."));
    await saveNotebook;

    const bicycle = await server.rpc.sessions.create();
    const saveBicycle = server.rpc.sessions.prompt({
      ...bicycle,
      text: "Red bicycle",
    });
    await llm.respond(m.assistant("Saved the bicycle."));
    await saveBicycle;

    await server.stop();
    await server.start();

    const recallNotebook = server.rpc.sessions.prompt({
      ...notebook,
      text: "Continue",
    });
    await llm.respond(({ messages }) =>
      m.assistant(
        messages
          .filter((message) => message.role === "user")
          .map((message) => contentText(message.content))
          .join(" → "),
      ),
    );
    await recallNotebook;
    expect(assistantReplies(await server.rpc.sessions.open(notebook))).toEqual([
      "Saved the notebook.",
      "Blue notebook → Continue",
    ]);

    const recallBicycle = server.rpc.sessions.prompt({
      ...bicycle,
      text: "Continue",
    });
    await llm.respond(({ messages }) =>
      m.assistant(
        messages
          .filter((message) => message.role === "user")
          .map((message) => contentText(message.content))
          .join(" → "),
      ),
    );
    await recallBicycle;
    expect(assistantReplies(await server.rpc.sessions.open(bicycle))).toEqual([
      "Saved the bicycle.",
      "Red bicycle → Continue",
    ]);
  },
);

serverTest("reads, writes, and lists workspace files", async ({ server }) => {
  expect(await server.rpc.workspace.get()).toMatchObject({
    workspaceRoot: server.workspaceRoot,
  });

  await server.rpc.workspace.writeFile({
    path: "notes/today.md",
    content: "# Today",
  });
  expect(await server.rpc.workspace.readFile({ path: "notes/today.md" })).toBe(
    "# Today",
  );
  expect(await server.rpc.workspace.listPaths()).toEqual(["notes/today.md"]);
});

serverTest(
  "omits hidden and dependency files from workspace listings",
  async ({ server }) => {
    await server.harness.files.write({
      path: path.join(server.workspaceRoot, ".hidden", "secret.txt"),
      content: "secret",
    });
    await server.harness.files.write({
      path: path.join(server.workspaceRoot, ".git", "config"),
      content: "repository",
    });
    await server.harness.files.write({
      path: path.join(server.workspaceRoot, "node_modules", "pkg.js"),
      content: "dependency",
    });
    await server.harness.files.write({
      path: path.join(server.workspaceRoot, "src", ".cache", "x"),
      content: "cache",
    });

    expect(await server.rpc.workspace.listPaths()).toEqual(["src/"]);
  },
);

serverTest(
  "publishes workspace file creates and deletes while ignoring updates and hidden files",
  async ({ server }) => {
    const events = await server.rpc.workspace.events();
    const initial = events.next();
    await server.harness.files.write({
      path: path.join(server.workspaceRoot, "src", "existing.ts"),
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
      path: path.join(server.workspaceRoot, "src", "created.ts"),
      content: "created",
    });
    await expect(created).resolves.toEqual({
      done: false,
      value: [{ type: "create", path: "src/created.ts" }],
    });

    const deleted = events.next();
    await server.harness.files.write({
      path: path.join(server.workspaceRoot, "src", "created.ts"),
      content: "updated",
    });
    await server.harness.files.write({
      path: path.join(server.workspaceRoot, ".hidden", "ignored.ts"),
      content: "ignored",
    });
    await fs.rm(path.join(server.workspaceRoot, "src", "existing.ts"));
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
  async ({ server, createServer }) => {
    const otherRoot = path.join(server.harness.paths.root, "other-workspace");
    await fs.mkdir(otherRoot);
    const other = createServer({ workspaceRoot: otherRoot });
    await other.start();

    await server.rpc.workspace.writeFile({
      path: "notes.md",
      content: "First workspace",
    });
    await other.rpc.workspace.writeFile({
      path: "notes.md",
      content: "Second workspace",
    });

    expect(await server.rpc.workspace.get()).toMatchObject({
      workspaceRoot: server.workspaceRoot,
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
  },
);

serverTest(
  "releases its port after the selected workspace fails to open",
  async ({ server }) => {
    await server.stop();
    const savedWorkspace = path.join(
      server.harness.paths.root,
      "saved-workspace",
    );
    await fs.rename(server.workspaceRoot, savedWorkspace);
    await fs.writeFile(
      server.workspaceRoot,
      "This is a file, not a workspace directory.",
    );

    await expect(server.start()).rejects.toThrow(
      "The selected workspace must be a directory.",
    );

    await fs.rm(server.workspaceRoot);
    await fs.rename(savedWorkspace, server.workspaceRoot);
    await server.start();
    await server.rpc.workspace.writeFile({
      path: "notes.md",
      content: "Ready after repair",
    });
    expect(await server.rpc.workspace.readFile({ path: "notes.md" })).toBe(
      "Ready after repair",
    );
  },
);

serverTest(
  "moves a folder while preserving the contents of a renamed note",
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
  },
);

serverTest(
  "refuses to overwrite an existing note when creating or moving files",
  async ({ server }) => {
    await server.rpc.workspace.writeFile({
      path: "Archive/Notes/Plan.md",
      content: "Keep this note",
    });
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
  },
);

serverTest("refuses to move a folder into itself", async ({ server }) => {
  await server.rpc.workspace.writeFile({
    path: "Archive/Notes/Plan.md",
    content: "Keep this note",
  });
  await expect(
    server.rpc.workspace.moveEntry({
      source: "Archive",
      destination: "Archive/Notes/Nested",
    }),
  ).rejects.toThrow("cannot be moved into itself");
});

serverTest(
  "rejects creating entries outside the visible workspace",
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
  },
);

serverTest(
  "does not create files through a workspace symlink",
  async ({ server }) => {
    const outside = path.join(server.harness.paths.root, "outside");
    await fs.mkdir(outside);
    await fs.symlink(
      outside,
      path.join(server.workspaceRoot, "Shortcut"),
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
    expect(await server.rpc.workspace.readFile({ path: "Keep.txt" })).toBe(
      "keep",
    );
  },
);

serverTest(
  "rejects deleting entries outside the visible workspace",
  async ({ server }) => {
    for (const invalid of ["", "../outside", ".pi"]) {
      await expect(
        server.rpc.workspace.deleteEntry({ path: invalid }),
      ).rejects.toThrow("not a workspace file");
    }
  },
);

serverTest(
  "serves an image preview with its original bytes and media type",
  async ({ server }) => {
    const image =
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="blue"/></svg>';
    await server.rpc.workspace.writeFile({ path: "Image.SVG", content: image });

    const preview = await server.rpc.workspace.previewFile({
      path: "Image.SVG",
    });

    expect(preview.kind).toBe("image");
    if (preview.kind !== "image") throw new Error("Expected image preview");
    expect(preview.file.type).toBe("image/svg+xml");
    expect(await preview.file.text()).toBe(image);
  },
);

serverTest("marks plain-text notes as editable", async ({ server }) => {
  await server.rpc.workspace.writeFile({
    path: "notes.txt",
    content: "Editable plain text",
  });

  expect(await server.rpc.workspace.previewFile({ path: "notes.txt" })).toEqual(
    { kind: "text" },
  );
});

serverTest("reports unsupported binary previews", async ({ server }) => {
  await server.harness.files.write({
    path: path.join(server.workspaceRoot, "archive.zip"),
    content: Buffer.from([80, 75, 0, 255]),
  });

  expect(
    await server.rpc.workspace.previewFile({ path: "archive.zip" }),
  ).toMatchObject({ kind: "unsupported" });
});

serverTest(
  "declines previews larger than the size limit",
  async ({ server }) => {
    const file = path.join(server.workspaceRoot, "large.txt");
    await fs.writeFile(file, "");
    await fs.truncate(file, 101 * 1024 * 1024);

    expect(
      await server.rpc.workspace.previewFile({ path: "large.txt" }),
    ).toMatchObject({ kind: "unsupported" });
  },
);

serverTest("rejects previews outside the workspace", async ({ server }) => {
  await expect(
    server.rpc.workspace.previewFile({ path: "../outside.txt" }),
  ).rejects.toThrow("not a workspace file");
});

serverTest("rejects previews through symlinks", async ({ server }) => {
  await server.rpc.workspace.writeFile({
    path: "notes.txt",
    content: "A note",
  });
  await fs.symlink(
    path.join(server.workspaceRoot, "notes.txt"),
    path.join(server.workspaceRoot, "link.txt"),
  );

  await expect(
    server.rpc.workspace.previewFile({ path: "link.txt" }),
  ).rejects.toThrow("not a workspace file");
});

function assistantReplies(
  session: Awaited<ReturnType<HaloClient["sessions"]["open"]>>,
) {
  return session.records.flatMap(({ value }) =>
    value.type === "message.committed" && value.message.role === "assistant"
      ? [contentText(value.message.content)]
      : [],
  );
}
