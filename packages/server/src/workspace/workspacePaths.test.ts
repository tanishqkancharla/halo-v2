import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  directoryPathsFromList,
  isSkippedRelativePath,
  mapFilesystemEventsToTreeEvents,
  shouldSkipEntryName,
  toPosixRelative,
} from "./WorkspaceService.js";

describe("workspace path helpers", () => {
  test("identifies skipped workspace paths", () => {
    expect(shouldSkipEntryName(".git")).toBe(true);
    expect(shouldSkipEntryName(".env")).toBe(true);
    expect(shouldSkipEntryName("node_modules")).toBe(true);
    expect(shouldSkipEntryName("src")).toBe(false);

    expect(isSkippedRelativePath(".hidden/file.txt")).toBe(true);
    expect(isSkippedRelativePath("src/.cache/x")).toBe(true);
    expect(isSkippedRelativePath("src/App.tsx")).toBe(false);
  });

  test("converts absolute paths within the workspace to POSIX paths", () => {
    const root = path.resolve("workspace");
    expect(toPosixRelative(root, path.join(root, "a", "b.txt"))).toBe(
      "a/b.txt",
    );
    expect(toPosixRelative(root, path.resolve("outside"))).toBeUndefined();
  });

  test("maps filesystem creates and deletes while dropping updates", () => {
    const root = path.resolve("workspace");
    const directories = directoryPathsFromList(["src/"]);
    const mapped = mapFilesystemEventsToTreeEvents(
      root,
      [
        { type: "update", path: path.join(root, "src", "a.ts") },
        {
          type: "create",
          path: path.join(root, "src", "b.ts"),
          kind: "file",
        },
        { type: "delete", path: path.join(root, "src", "a.ts") },
        { type: "create", path: path.join(root, ".env"), kind: "file" },
      ],
      directories,
    );

    expect(mapped).toEqual([
      { type: "create", path: "src/b.ts" },
      { type: "delete", path: "src/a.ts" },
    ]);
  });

  test("tracks directories created mid-session and emits a trailing-slash delete on removal", () => {
    const root = path.resolve("workspace");
    const directories = directoryPathsFromList([]);
    const created = mapFilesystemEventsToTreeEvents(
      root,
      [
        {
          type: "create",
          path: path.join(root, "module", "sub"),
          kind: "directory",
        },
      ],
      directories,
    );
    expect(created).toEqual([{ type: "create", path: "module/sub/" }]);
    expect(directories.has("module/sub/")).toBe(true);

    const deleted = mapFilesystemEventsToTreeEvents(
      root,
      [{ type: "delete", path: path.join(root, "module", "sub") }],
      directories,
    );
    expect(deleted).toEqual([{ type: "delete", path: "module/sub/" }]);
    expect(directories.has("module/sub/")).toBe(false);
  });

  test("emits a trailing-slash delete for a tracked directory and drops its tracked descendants", () => {
    const root = path.resolve("workspace");
    const directories = directoryPathsFromList(["module/", "module/sub/"]);
    const mapped = mapFilesystemEventsToTreeEvents(
      root,
      [{ type: "delete", path: path.join(root, "module") }],
      directories,
    );
    expect(mapped).toEqual([{ type: "delete", path: "module/" }]);
    expect(directories.has("module/")).toBe(false);
    expect(directories.has("module/sub/")).toBe(false);
  });

  test("emits a no-slash delete for a path that is not a tracked directory", () => {
    const root = path.resolve("workspace");
    const directories = directoryPathsFromList([]);
    const mapped = mapFilesystemEventsToTreeEvents(
      root,
      [{ type: "delete", path: path.join(root, "module", "index.ts") }],
      directories,
    );
    expect(mapped).toEqual([{ type: "delete", path: "module/index.ts" }]);
  });
});
