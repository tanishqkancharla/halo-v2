import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FilesystemService } from "../../../filesystem/FilesystemService.js";
import { FilesPatchError, patchFiles } from "./patch.js";

const patchTest = test.extend<{ cwd: string }>({
  cwd: async ({ task }, use) => {
    const slug = task.id.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const dir = mkdtempSync(join(tmpdir(), `patch-${slug || "test"}-`));
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
});

function patch(...lines: string[]): string {
  return lines.join("\n");
}

function write(cwd: string, path: string, content: string): void {
  writeFileSync(join(cwd, path), content);
}

function read(cwd: string, path: string): string {
  return readFileSync(join(cwd, path), "utf8");
}

async function apply(
  filesystem: FilesystemService,
  cwd: string,
  patchText: string,
) {
  const result = await patchFiles({ filesystem, cwd, input: { patchText } });
  if (result instanceof Error) throw result;
  return result;
}

describe("apply_patch: multiple Update File hunks for the same path", () => {
  patchTest(
    "applies every hunk in order when no hunk changes line count",
    async ({ cwd }) => {
      const filesystem = new FilesystemService();
      write(cwd, "foo.txt", "line1\nline2\nline3\n");
      const patchText = patch(
        "*** Begin Patch",
        "*** Update File: foo.txt",
        "@@",
        "-line1",
        "+LINE1",
        "*** Update File: foo.txt",
        "@@",
        "-line3",
        "+LINE3",
        "*** End Patch",
      );

      await apply(filesystem, cwd, patchText);

      expect(read(cwd, "foo.txt")).toBe("LINE1\nline2\nLINE3\n");
    },
  );

  patchTest(
    "recomputes offsets when an earlier same-path hunk adds lines",
    async ({ cwd }) => {
      const filesystem = new FilesystemService();
      write(cwd, "foo.txt", "line1\nline2\nline3\n");
      const patchText = patch(
        "*** Begin Patch",
        "*** Update File: foo.txt",
        "@@",
        "-line1",
        "+LINE1A",
        "+LINE1B",
        "*** Update File: foo.txt",
        "@@",
        "-line3",
        "+LINE3",
        "*** End Patch",
      );

      await apply(filesystem, cwd, patchText);

      expect(read(cwd, "foo.txt")).toBe("LINE1A\nLINE1B\nline2\nLINE3\n");
    },
  );

  patchTest(
    "moves the file when a later same-path hunk carries Move to",
    async ({ cwd }) => {
      const filesystem = new FilesystemService();
      write(cwd, "foo.txt", "a\nb\n");
      const patchText = patch(
        "*** Begin Patch",
        "*** Update File: foo.txt",
        "@@",
        "-a",
        "+A",
        "*** Update File: foo.txt",
        "*** Move to: bar.txt",
        "@@",
        "-b",
        "+B",
        "*** End Patch",
      );

      await apply(filesystem, cwd, patchText);

      expect(read(cwd, "bar.txt")).toBe("A\nB\n");
      expect(filesystem.exists(join(cwd, "foo.txt"))).toBe(false);
    },
  );

  patchTest(
    "rejects conflicting same-path hunks instead of silently corrupting",
    async ({ cwd }) => {
      const filesystem = new FilesystemService();
      write(cwd, "foo.txt", "a\nb\n");
      const patchText = patch(
        "*** Begin Patch",
        "*** Update File: foo.txt",
        "@@",
        "-a",
        "+A",
        "*** Update File: foo.txt",
        "@@",
        "-a",
        "+Z",
        "*** End Patch",
      );

      const result = await patchFiles({
        filesystem,
        cwd,
        input: { patchText },
      });

      expect(result).toBeInstanceOf(FilesPatchError);
    },
  );
});
