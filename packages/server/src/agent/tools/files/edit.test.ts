import path from "node:path";
import * as errore from "errore";
import { describe, expect, test as baseTest } from "vitest";
import { FilesystemService } from "../../../filesystem/FilesystemService.js";
import { editFile, FilesEditError } from "./edit.js";
import { createTestArtifacts } from "../../../../test/TestArtifacts.js";

const test = baseTest.extend<{ cwd: string }>({
  cwd: async ({ task }, use) => {
    const artifacts = await createTestArtifacts(task.id);
    await using cleanup = new errore.AsyncDisposableStack();
    cleanup.defer(() =>
      artifacts.finish({ passed: task.result?.state === "pass" }),
    );
    await use(artifacts.paths.workspace);
  },
});

async function seed(
  filesystem: FilesystemService,
  cwd: string,
  name: string,
  content: string,
): Promise<void> {
  const result = await filesystem.writeFile(
    path.join(cwd, name),
    content,
    "utf8",
  );
  if (result instanceof Error) throw result;
}

async function readBack(
  filesystem: FilesystemService,
  cwd: string,
  name: string,
): Promise<string> {
  const result = await filesystem.readFile(path.join(cwd, name), "utf8");
  if (result instanceof Error) throw result;
  return result;
}

describe("editFile", () => {
  describe("replacement text is inserted literally", () => {
    test("single replace inserts all four special sequences literally", async ({
      cwd,
    }) => {
      const filesystem = new FilesystemService();
      await seed(filesystem, cwd, "f.txt", "before MARKER after");
      const newText = "$$ $& $` $'";

      const result = await editFile({
        filesystem,
        cwd,
        input: { path: "f.txt", oldText: "MARKER", newText },
      });
      if (result instanceof Error) throw result;

      expect(result).toEqual({ path: "f.txt", replacements: 1 });
      expect(await readBack(filesystem, cwd, "f.txt")).toBe(
        "before $$ $& $` $' after",
      );
    });

    test("replaceAll inserts special sequences literally across every match", async ({
      cwd,
    }) => {
      const filesystem = new FilesystemService();
      await seed(filesystem, cwd, "f.txt", "foo bar foo baz foo");

      const result = await editFile({
        filesystem,
        cwd,
        input: {
          path: "f.txt",
          oldText: "foo",
          newText: "$& $$",
          replaceAll: true,
        },
      });
      if (result instanceof Error) throw result;

      expect(result).toEqual({ path: "f.txt", replacements: 3 });
      expect(await readBack(filesystem, cwd, "f.txt")).toBe(
        "$& $$ bar $& $$ baz $& $$",
      );
    });

    test("non-special $ sequences pass through verbatim", async ({ cwd }) => {
      const filesystem = new FilesystemService();
      await seed(filesystem, cwd, "f.txt", "value = placeholder;");
      const passthrough = "$1 $2 $5.00 ${name} $<n> $end";

      const result = await editFile({
        filesystem,
        cwd,
        input: { path: "f.txt", oldText: "placeholder", newText: passthrough },
      });
      if (result instanceof Error) throw result;

      expect(await readBack(filesystem, cwd, "f.txt")).toBe(
        `value = ${passthrough};`,
      );
    });
  });

  describe("occurrence semantics", () => {
    test("replaceAll reports the number of matches replaced", async ({
      cwd,
    }) => {
      const filesystem = new FilesystemService();
      await seed(filesystem, cwd, "f.txt", "foo bar foo");

      const result = await editFile({
        filesystem,
        cwd,
        input: {
          path: "f.txt",
          oldText: "foo",
          newText: "$&",
          replaceAll: true,
        },
      });
      if (result instanceof Error) throw result;

      expect(result).toEqual({ path: "f.txt", replacements: 2 });
      expect(await readBack(filesystem, cwd, "f.txt")).toBe("$& bar $&");
    });

    test("single replace with multiple occurrences returns FilesEditError and leaves the file unchanged", async ({
      cwd,
    }) => {
      const filesystem = new FilesystemService();
      await seed(filesystem, cwd, "f.txt", "foo bar foo");

      const result = await editFile({
        filesystem,
        cwd,
        input: { path: "f.txt", oldText: "foo", newText: "$&" },
      });

      expect(result).toBeInstanceOf(FilesEditError);
      expect(await readBack(filesystem, cwd, "f.txt")).toBe("foo bar foo");
    });

    test("returns FilesEditError when oldText is not found", async ({
      cwd,
    }) => {
      const filesystem = new FilesystemService();
      await seed(filesystem, cwd, "f.txt", "hello world");

      const result = await editFile({
        filesystem,
        cwd,
        input: { path: "f.txt", oldText: "missing", newText: "$&" },
      });

      expect(result).toBeInstanceOf(FilesEditError);
      expect(await readBack(filesystem, cwd, "f.txt")).toBe("hello world");
    });
  });

  describe("line-ending and BOM preservation", () => {
    test("preserves CRLF line endings while inserting $$ literally", async ({
      cwd,
    }) => {
      const filesystem = new FilesystemService();
      await seed(filesystem, cwd, "f.txt", "line1\r\nline2\r\n");

      const result = await editFile({
        filesystem,
        cwd,
        input: { path: "f.txt", oldText: "line1", newText: "$$" },
      });
      if (result instanceof Error) throw result;

      expect(await readBack(filesystem, cwd, "f.txt")).toBe("$$\r\nline2\r\n");
    });

    test("preserves a BOM while inserting $& literally", async ({ cwd }) => {
      const filesystem = new FilesystemService();
      await seed(filesystem, cwd, "f.txt", "\uFEFFline1\nline2\n");

      const result = await editFile({
        filesystem,
        cwd,
        input: { path: "f.txt", oldText: "line1", newText: "$&" },
      });
      if (result instanceof Error) throw result;

      expect(await readBack(filesystem, cwd, "f.txt")).toBe(
        "\uFEFF$&\nline2\n",
      );
    });
  });
});
