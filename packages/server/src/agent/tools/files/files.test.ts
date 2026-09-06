import fs from "node:fs/promises";
import path from "node:path";
import * as errore from "errore";
import { describe, expect, test as baseTest } from "vitest";
import { createTestArtifacts } from "../../../../test/TestArtifacts.js";
import { FilesystemService } from "../../../filesystem/FilesystemService.js";
import { deleteFile } from "./delete.js";
import { editFile } from "./edit.js";
import { patchFiles, FilesPatchError } from "./patch.js";
import { readFile } from "./read.js";
import { writeFile } from "./write.js";
import {
  FilesInvalidPathError,
  resolveInsideWorkspace,
} from "./workspacePath.js";

type Sandbox = {
  cwd: string;
  outsidePath: string;
  outsideDir: string;
  filesystem: FilesystemService;
};

const test = baseTest.extend<{ sandbox: Sandbox }>({
  sandbox: async ({ task }, use) => {
    const artifacts = await createTestArtifacts(task.id);
    await using cleanup = new errore.AsyncDisposableStack();
    cleanup.defer(() =>
      artifacts.finish({ passed: task.result?.state === "pass" }),
    );

    // `workspace/` is the agent cwd; `outside/` is a sibling inside the test
    // root but outside the workspace, so `../outside/...` escapes the cwd.
    await artifacts.harness.files.write({
      path: path.join("outside", "target.txt"),
      content: "outside",
    });
    await artifacts.harness.files.write({
      path: path.join("workspace", "inside.txt"),
      content: "inside",
    });

    const root = artifacts.paths.root;
    await use({
      cwd: artifacts.paths.workspace,
      outsidePath: path.join(root, "outside", "target.txt"),
      outsideDir: path.join(root, "outside"),
      filesystem: new FilesystemService(),
    });
  },
});

function exists(p: string): Promise<boolean> {
  return fs.access(p).then(
    () => true,
    () => false,
  );
}

describe("resolveInsideWorkspace", () => {
  test("accepts a clean workspace-relative path", () => {
    const cwd = path.resolve("workspace");
    expect(resolveInsideWorkspace(cwd, "a/b.txt")).toEqual({
      absolutePath: path.join(cwd, "a", "b.txt"),
    });
  });

  test("rejects a `..` traversal", () => {
    const cwd = path.resolve("workspace");
    expect(resolveInsideWorkspace(cwd, "../outside.txt")).toBeInstanceOf(
      FilesInvalidPathError,
    );
  });

  test("rejects an absolute path", () => {
    const cwd = path.resolve("workspace");
    expect(resolveInsideWorkspace(cwd, path.resolve("outside"))).toBeInstanceOf(
      FilesInvalidPathError,
    );
  });
});

describe("deleteFile", () => {
  test("deletes a workspace file", async ({ sandbox }) => {
    const { cwd, filesystem } = sandbox;
    const result = await deleteFile({
      filesystem,
      cwd,
      input: { path: "inside.txt" },
    });
    expect(result).toEqual({ path: "inside.txt" });
    expect(await exists(path.join(cwd, "inside.txt"))).toBe(false);
  });

  test("rejects a `..` traversal path and leaves the outside file", async ({
    sandbox,
  }) => {
    const { cwd, outsidePath, filesystem } = sandbox;
    const result = await deleteFile({
      filesystem,
      cwd,
      input: { path: "../outside/target.txt" },
    });
    expect(result).toBeInstanceOf(FilesInvalidPathError);
    expect(await exists(outsidePath)).toBe(true);
    expect(await fs.readFile(outsidePath, "utf8")).toBe("outside");
  });

  test("rejects an absolute path and leaves the outside file", async ({
    sandbox,
  }) => {
    const { cwd, outsidePath, filesystem } = sandbox;
    const result = await deleteFile({
      filesystem,
      cwd,
      input: { path: outsidePath },
    });
    expect(result).toBeInstanceOf(FilesInvalidPathError);
    expect(await exists(outsidePath)).toBe(true);
  });
});

describe("readFile", () => {
  test("reads a workspace file", async ({ sandbox }) => {
    const { cwd, filesystem } = sandbox;
    const result = await readFile({
      filesystem,
      cwd,
      input: { path: "inside.txt" },
    });
    expect(result).toEqual({ path: "inside.txt", text: "inside" });
  });

  test("rejects a `..` traversal path", async ({ sandbox }) => {
    const { cwd, outsidePath, filesystem } = sandbox;
    const result = await readFile({
      filesystem,
      cwd,
      input: { path: "../outside/target.txt" },
    });
    expect(result).toBeInstanceOf(FilesInvalidPathError);
    expect(await fs.readFile(outsidePath, "utf8")).toBe("outside");
  });

  test("rejects an absolute path", async ({ sandbox }) => {
    const { cwd, outsidePath, filesystem } = sandbox;
    const result = await readFile({
      filesystem,
      cwd,
      input: { path: outsidePath },
    });
    expect(result).toBeInstanceOf(FilesInvalidPathError);
    expect(await fs.readFile(outsidePath, "utf8")).toBe("outside");
  });
});

describe("writeFile", () => {
  test("writes a workspace file", async ({ sandbox }) => {
    const { cwd, filesystem } = sandbox;
    const result = await writeFile({
      filesystem,
      cwd,
      input: { path: "new.txt", content: "hello" },
    });
    expect(result).toEqual({ path: "new.txt" });
    expect(await fs.readFile(path.join(cwd, "new.txt"), "utf8")).toBe("hello");
  });

  test("rejects a `..` traversal path and writes nothing outside", async ({
    sandbox,
  }) => {
    const { cwd, outsideDir, filesystem } = sandbox;
    const result = await writeFile({
      filesystem,
      cwd,
      input: { path: "../outside/injected.txt", content: "pwned" },
    });
    expect(result).toBeInstanceOf(FilesInvalidPathError);
    expect(await exists(path.join(outsideDir, "injected.txt"))).toBe(false);
  });

  test("rejects an absolute path and writes nothing outside", async ({
    sandbox,
  }) => {
    const { cwd, outsideDir, filesystem } = sandbox;
    const result = await writeFile({
      filesystem,
      cwd,
      input: {
        path: path.join(outsideDir, "absolute.txt"),
        content: "pwned",
      },
    });
    expect(result).toBeInstanceOf(FilesInvalidPathError);
    expect(await exists(path.join(outsideDir, "absolute.txt"))).toBe(false);
  });
});

describe("editFile", () => {
  test("edits a workspace file", async ({ sandbox }) => {
    const { cwd, filesystem } = sandbox;
    const result = await editFile({
      filesystem,
      cwd,
      input: { path: "inside.txt", oldText: "inside", newText: "INSIDE" },
    });
    expect(result).toEqual({ path: "inside.txt", replacements: 1 });
    expect(await fs.readFile(path.join(cwd, "inside.txt"), "utf8")).toBe(
      "INSIDE",
    );
  });

  test("rejects a `..` traversal path and leaves the outside file", async ({
    sandbox,
  }) => {
    const { cwd, outsidePath, filesystem } = sandbox;
    const result = await editFile({
      filesystem,
      cwd,
      input: {
        path: "../outside/target.txt",
        oldText: "outside",
        newText: "CHANGED",
      },
    });
    expect(result).toBeInstanceOf(FilesInvalidPathError);
    expect(await fs.readFile(outsidePath, "utf8")).toBe("outside");
  });

  test("rejects an absolute path and leaves the outside file", async ({
    sandbox,
  }) => {
    const { cwd, outsidePath, filesystem } = sandbox;
    const result = await editFile({
      filesystem,
      cwd,
      input: {
        path: outsidePath,
        oldText: "outside",
        newText: "CHANGED",
      },
    });
    expect(result).toBeInstanceOf(FilesInvalidPathError);
    expect(await fs.readFile(outsidePath, "utf8")).toBe("outside");
  });
});

describe("patchFiles", () => {
  test("applies a patch that adds a workspace file", async ({ sandbox }) => {
    const { cwd, filesystem } = sandbox;
    const patchText = [
      "*** Begin Patch",
      "*** Add File: new.txt",
      "+hello",
      "*** End Patch",
    ].join("\n");
    const result = await patchFiles({ filesystem, cwd, input: { patchText } });
    expect(result).toEqual({ added: ["new.txt"], modified: [], deleted: [] });
    expect(await fs.readFile(path.join(cwd, "new.txt"), "utf8")).toBe(
      "hello\n",
    );
  });

  test("applies a patch that updates a workspace file", async ({ sandbox }) => {
    const { cwd, filesystem } = sandbox;
    const patchText = [
      "*** Begin Patch",
      "*** Update File: inside.txt",
      "-inside",
      "+INSIDE",
      "*** End Patch",
    ].join("\n");
    const result = await patchFiles({ filesystem, cwd, input: { patchText } });
    expect(result).toEqual({
      added: [],
      modified: ["inside.txt"],
      deleted: [],
    });
    expect(await fs.readFile(path.join(cwd, "inside.txt"), "utf8")).toBe(
      "INSIDE\n",
    );
  });

  test("rejects a patch that adds a file outside the workspace", async ({
    sandbox,
  }) => {
    const { cwd, outsideDir, filesystem } = sandbox;
    const patchText = [
      "*** Begin Patch",
      "*** Add File: ../outside/injected.txt",
      "+pwned",
      "*** End Patch",
    ].join("\n");
    const result = await patchFiles({ filesystem, cwd, input: { patchText } });
    expect(result).toBeInstanceOf(FilesPatchError);
    expect(await exists(path.join(outsideDir, "injected.txt"))).toBe(false);
  });

  test("rejects a patch that deletes a file outside the workspace", async ({
    sandbox,
  }) => {
    const { cwd, outsidePath, filesystem } = sandbox;
    const patchText = [
      "*** Begin Patch",
      "*** Delete File: ../outside/target.txt",
      "*** End Patch",
    ].join("\n");
    const result = await patchFiles({ filesystem, cwd, input: { patchText } });
    expect(result).toBeInstanceOf(FilesPatchError);
    expect(await exists(outsidePath)).toBe(true);
    expect(await fs.readFile(outsidePath, "utf8")).toBe("outside");
  });

  test("rejects a patch that updates a file outside the workspace", async ({
    sandbox,
  }) => {
    const { cwd, outsidePath, filesystem } = sandbox;
    const patchText = [
      "*** Begin Patch",
      "*** Update File: ../outside/target.txt",
      "-outside",
      "+CHANGED",
      "*** End Patch",
    ].join("\n");
    const result = await patchFiles({ filesystem, cwd, input: { patchText } });
    expect(result).toBeInstanceOf(FilesPatchError);
    expect(await fs.readFile(outsidePath, "utf8")).toBe("outside");
  });

  test("rejects a patch that moves a workspace file outside the workspace", async ({
    sandbox,
  }) => {
    const { cwd, outsideDir, filesystem } = sandbox;
    const patchText = [
      "*** Begin Patch",
      "*** Update File: inside.txt",
      "*** Move to: ../outside/moved.txt",
      "-inside",
      "+CHANGED",
      "*** End Patch",
    ].join("\n");
    const result = await patchFiles({ filesystem, cwd, input: { patchText } });
    expect(result).toBeInstanceOf(FilesPatchError);
    // The source file is left in place, unmodified ...
    expect(await fs.readFile(path.join(cwd, "inside.txt"), "utf8")).toBe(
      "inside",
    );
    // ... and nothing is written outside the workspace.
    expect(await exists(path.join(outsideDir, "moved.txt"))).toBe(false);
  });
});
