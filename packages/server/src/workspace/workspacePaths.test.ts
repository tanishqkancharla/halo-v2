import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { FilesystemService } from "../filesystem/FilesystemService.js";
import type { WorkspaceTreeEvent } from "@get-halo/shared/rpc";
import {
  directoryPathsFromList,
  expandDirectoryCreateEvents,
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

async function tempWorkspaceRoot(label: string) {
  const root = await mkdtemp(path.join(tmpdir(), `halo-${label}-`));
  return root;
}

function sortedChildPaths(events: WorkspaceTreeEvent[]) {
  return events
    .slice(1)
    .map((event) => event.path)
    .toSorted();
}

describe("expandDirectoryCreateEvents", () => {
  test("enumerates a populated directory's contents as create events", async () => {
    const root = await tempWorkspaceRoot("expand-populated");
    const filesystem = new FilesystemService();
    try {
      await mkdir(path.join(root, "imported", "deep"), { recursive: true });
      await writeFile(path.join(root, "imported", "in.txt"), "x");
      await writeFile(path.join(root, "imported", "deep", "note.md"), "y");

      const directoryPaths = new Set<string>(["imported/"]);
      const expanded = await expandDirectoryCreateEvents(
        filesystem,
        root,
        [{ type: "create", path: "imported/" }],
        directoryPaths,
      );

      expect(expanded[0]).toEqual({ type: "create", path: "imported/" });
      // Child paths are byte-identical to listRelativeWorkspacePaths output
      // (single-slash separators, no trailing slash on files), regardless of
      // the trailing slash on the directory event.
      expect(sortedChildPaths(expanded)).toEqual([
        "imported/deep/note.md",
        "imported/in.txt",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("records empty subdirectories as placeholder creates in directoryPaths", async () => {
    const root = await tempWorkspaceRoot("expand-empty-subdir");
    const filesystem = new FilesystemService();
    try {
      await mkdir(path.join(root, "imported", "empty"), { recursive: true });
      await writeFile(path.join(root, "imported", "in.txt"), "x");

      const directoryPaths = new Set<string>(["imported/"]);
      const expanded = await expandDirectoryCreateEvents(
        filesystem,
        root,
        [{ type: "create", path: "imported/" }],
        directoryPaths,
      );

      expect(expanded[0]).toEqual({ type: "create", path: "imported/" });
      expect(sortedChildPaths(expanded)).toEqual([
        "imported/empty/",
        "imported/in.txt",
      ]);
      // Empty subdirs discovered during expansion are tracked so future delete
      // events for them emit trailing-slash deletes that the renderer cleans up.
      expect(directoryPaths).toContain("imported/empty/");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("does not duplicate an empty directory's own placeholder", async () => {
    const root = await tempWorkspaceRoot("expand-empty-dir");
    const filesystem = new FilesystemService();
    try {
      await mkdir(path.join(root, "empty"), { recursive: true });

      const directoryPaths = new Set<string>();
      const expanded = await expandDirectoryCreateEvents(
        filesystem,
        root,
        [{ type: "create", path: "empty/" }],
        directoryPaths,
      );

      // walkDirectory emits "empty/" as the self-reference placeholder for an
      // empty dir; the create event already represents it, so it is skipped.
      expect(expanded).toEqual([{ type: "create", path: "empty/" }]);
      expect(directoryPaths).not.toContain("empty/");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("forwards the create event when the directory is gone before the walk", async () => {
    const root = await tempWorkspaceRoot("expand-deleted");
    const filesystem = new FilesystemService();
    try {
      // The directory "missing/" never existed; walkDirectory fails with ENOENT.
      const directoryPaths = new Set<string>();
      const expanded = await expandDirectoryCreateEvents(
        filesystem,
        root,
        [{ type: "create", path: "missing/" }],
        directoryPaths,
      );

      // The create is still forwarded; a subsequent delete cleans up the tree.
      expect(expanded).toEqual([{ type: "create", path: "missing/" }]);
      expect(directoryPaths).not.toContain("missing/");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("passes file creates and delete events through unchanged", async () => {
    const root = await tempWorkspaceRoot("expand-passthrough");
    const filesystem = new FilesystemService();
    try {
      await mkdir(path.join(root, "dir", "sub"), { recursive: true });
      await writeFile(path.join(root, "dir", "sub", "note.md"), "y");

      const directoryPaths = new Set<string>();
      const input: WorkspaceTreeEvent[] = [
        { type: "create", path: "file.txt" },
        { type: "delete", path: "old/" },
        { type: "create", path: "dir/" },
      ];
      const expanded = await expandDirectoryCreateEvents(
        filesystem,
        root,
        input,
        directoryPaths,
      );

      // Non-directory-create events are emitted verbatim in order; only the
      // directory create is expanded with its walked child appended after it.
      expect(expanded).toEqual([
        { type: "create", path: "file.txt" },
        { type: "delete", path: "old/" },
        { type: "create", path: "dir/" },
        { type: "create", path: "dir/sub/note.md" },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("skips hidden entries, node_modules, and symlinks like the initial walk", async () => {
    const root = await tempWorkspaceRoot("expand-skip-rules");
    const filesystem = new FilesystemService();
    try {
      await mkdir(path.join(root, "imported", "deep"), { recursive: true });
      await mkdir(path.join(root, "imported", ".hidden"), { recursive: true });
      await mkdir(path.join(root, "imported", "node_modules", "pkg"), {
        recursive: true,
      });
      await writeFile(path.join(root, "imported", "in.txt"), "x");
      await writeFile(path.join(root, "imported", "deep", "note.md"), "y");
      await writeFile(path.join(root, "imported", ".hidden", "secret"), "s");
      await writeFile(
        path.join(root, "imported", "node_modules", "pkg", "index.js"),
        "ok",
      );
      const outside = await mkdtemp(path.join(tmpdir(), "outside-"));
      await symlink(outside, path.join(root, "imported", "link-to-dir"));

      const directoryPaths = new Set<string>(["imported/"]);
      const expanded = await expandDirectoryCreateEvents(
        filesystem,
        root,
        [{ type: "create", path: "imported/" }],
        directoryPaths,
      );

      expect(expanded[0]).toEqual({ type: "create", path: "imported/" });
      // Same skip rules as listRelativeWorkspacePaths: dotfiles, node_modules,
      // and symlinks are excluded; only non-skipped real files/dirs surface.
      expect(sortedChildPaths(expanded)).toEqual([
        "imported/deep/note.md",
        "imported/in.txt",
      ]);
      expect(directoryPaths).not.toContain("imported/.hidden/");
      expect(directoryPaths).not.toContain("imported/node_modules/");
      await rm(outside, { recursive: true, force: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
