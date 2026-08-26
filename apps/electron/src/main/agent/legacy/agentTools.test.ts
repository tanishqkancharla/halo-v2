import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createAgentTools } from "./agentTools.js";

async function testDirectory(name: string) {
  return mkdtemp(join(tmpdir(), `halo-exec-${name}-`));
}

describe("createAgentTools", () => {
  test("writes, reads, and deletes a file", async () => {
    const cwd = await testDirectory("files");
    const tools = createAgentTools(cwd);

    const written = await tools.files.write("note.txt", "hello");
    expect(written).toEqual({ path: "note.txt" });

    const read = await tools.files.read("note.txt");
    expect(read).toEqual({ path: "note.txt", text: "hello" });

    const deleted = await tools.files.delete("note.txt");
    expect(deleted).toEqual({ path: "note.txt" });

    const missing = await tools.files.read("note.txt");
    expect(missing).toBeInstanceOf(Error);
  });

  test("edits a unique string once", async () => {
    const cwd = await testDirectory("edit-once");
    const tools = createAgentTools(cwd);
    const written = await tools.files.write(
      "a.ts",
      "const x = 1;\nconst y = 2;\n",
    );
    expect(written).not.toBeInstanceOf(Error);

    const edited = await tools.files.edit(
      "a.ts",
      "const x = 1;",
      "const x = 3;",
    );
    expect(edited).toEqual({ path: "a.ts", replacements: 1 });

    const read = await tools.files.read("a.ts");
    expect(read).toEqual({
      path: "a.ts",
      text: "const x = 3;\nconst y = 2;\n",
    });
  });

  test("fails when oldText is not unique", async () => {
    const cwd = await testDirectory("edit-ambiguous");
    const tools = createAgentTools(cwd);
    const written = await tools.files.write("a.ts", "foo\nfoo\n");
    expect(written).not.toBeInstanceOf(Error);

    const edited = await tools.files.edit("a.ts", "foo", "bar");
    expect(edited).toBeInstanceOf(Error);
  });

  test("replaces all occurrences when replaceAll is true", async () => {
    const cwd = await testDirectory("edit-all");
    const tools = createAgentTools(cwd);
    const written = await tools.files.write("a.ts", "foo\nfoo\n");
    expect(written).not.toBeInstanceOf(Error);

    const edited = await tools.files.edit("a.ts", "foo", "bar", {
      replaceAll: true,
    });
    expect(edited).toEqual({ path: "a.ts", replacements: 2 });

    const read = await tools.files.read("a.ts");
    expect(read).toEqual({ path: "a.ts", text: "bar\nbar\n" });
  });

  test("applies a Codex update patch", async () => {
    const cwd = await testDirectory("patch-update");
    const tools = createAgentTools(cwd);
    const written = await tools.files.write("a.ts", "const x = 1;\n");
    expect(written).not.toBeInstanceOf(Error);

    const patched = await tools.files.patch(`*** Begin Patch
*** Update File: a.ts
@@
-const x = 1;
+const x = 2;
*** End Patch`);
    expect(patched).toEqual({
      added: [],
      modified: ["a.ts"],
      deleted: [],
    });

    const read = await tools.files.read("a.ts");
    expect(read).toEqual({ path: "a.ts", text: "const x = 2;\n" });
  });

  test("rejects malformed patch text", async () => {
    const cwd = await testDirectory("patch-bad");
    const tools = createAgentTools(cwd);

    const patched = await tools.files.patch("not a patch");
    expect(patched).toBeInstanceOf(Error);
  });

  test("runs a bash command and returns stdout", async () => {
    const cwd = await testDirectory("bash-echo");
    const tools = createAgentTools(cwd);

    const result = await tools.bash.run("echo hello");
    expect(result).not.toBeInstanceOf(Error);
    if (result instanceof Error) return;
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("hello");
  });

  test("returns the exit code from bash", async () => {
    const cwd = await testDirectory("bash-exit");
    const tools = createAgentTools(cwd);

    const result = await tools.bash.run("exit 7");
    expect(result).not.toBeInstanceOf(Error);
    if (result instanceof Error) return;
    expect(result.code).toBe(7);
  });
});
