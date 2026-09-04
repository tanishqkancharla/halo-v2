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
});
