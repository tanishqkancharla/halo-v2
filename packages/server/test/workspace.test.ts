import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";
import { contentText, fauxAssistantMessage } from "@earendil-works/pi-ai";
import { serverTest } from "./serverTest.js";

serverTest(
  "answers through the LLM supplied by the server host",
  async ({ server, llm }) => {
    const { sessionId } = await server.rpc.sessions.create();
    const prompted = server.rpc.sessions.prompt({
      sessionId,
      text: "Hello from the API",
    });
    const request = await llm.nextRequest();
    if (request instanceof Error) throw request;
    const responded = llm.respond({
      id: request.id,
      message: fauxAssistantMessage("Hello from the supplied LLM."),
    });
    if (responded instanceof Error) throw responded;
    await prompted;

    const session = await server.rpc.sessions.open({ sessionId });
    const answers = session.records.flatMap(({ value }) =>
      value.type === "message.committed" && value.message.role === "assistant"
        ? [contentText(value.message.content)]
        : [],
    );
    expect(answers).toEqual(["Hello from the supplied LLM."]);
  },
);

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
