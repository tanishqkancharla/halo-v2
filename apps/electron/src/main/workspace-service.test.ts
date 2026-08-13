import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  WorkspaceIoError,
  WorkspaceNotDirectoryError,
  WorkspaceNotReadyError,
  WorkspaceService,
  directoryPathsFromList,
  isSkippedRelativePath,
  mapParcelEventsToTreeEvents,
  shouldSkipEntryName,
  toPosixRelative,
} from "./workspace-service.js";

async function testDirectory(name: string) {
  return mkdtemp(join(tmpdir(), `halo-${name}-`));
}

describe("WorkspaceService", () => {
  test("selects a directory and creates Pi session storage", async () => {
    const root = await testDirectory("workspace");
    const appDataDir = await testDirectory("app-data");
    const resolvedRoot = await realpath(root);
    const service = new WorkspaceService(appDataDir);

    await expect(service.select(root)).resolves.toEqual({
      name: basename(resolvedRoot),
      workspaceRoot: resolvedRoot,
    });
    expect(service.getLayout()).toEqual({
      root: resolvedRoot,
      agentDir: join(resolvedRoot, ".pi", "agent"),
      sessionDir: join(resolvedRoot, ".pi", "agent", "sessions"),
    });
  });

  test("saves the selected workspace under app data", async () => {
    const root = await testDirectory("workspace");
    const appDataDir = await testDirectory("app-data");
    const resolvedRoot = await realpath(root);
    const service = new WorkspaceService(appDataDir);

    const selected = await service.select(root);
    expect(selected).not.toBeInstanceOf(Error);

    expect(
      JSON.parse(await readFile(join(appDataDir, "workspace.json"), "utf8")),
    ).toEqual({ workspaceRoot: resolvedRoot });
  });

  test("restores the saved workspace from app data", async () => {
    const root = await testDirectory("workspace");
    const appDataDir = await testDirectory("app-data");
    const resolvedRoot = await realpath(root);
    const selected = await new WorkspaceService(appDataDir).select(root);
    expect(selected).not.toBeInstanceOf(Error);

    const restored = await new WorkspaceService(appDataDir).restore();

    expect(restored).toEqual({
      name: basename(resolvedRoot),
      workspaceRoot: resolvedRoot,
    });
  });

  test("restore returns undefined when nothing is saved", async () => {
    const appDataDir = await testDirectory("app-data");

    await expect(
      new WorkspaceService(appDataDir).restore(),
    ).resolves.toBeUndefined();
  });

  test("restore clears a missing saved workspace", async () => {
    const root = await testDirectory("workspace");
    const appDataDir = await testDirectory("app-data");
    const selected = await new WorkspaceService(appDataDir).select(root);
    expect(selected).not.toBeInstanceOf(Error);
    await rm(root, { recursive: true, force: true });

    await expect(
      new WorkspaceService(appDataDir).restore(),
    ).resolves.toBeUndefined();
    await expect(
      readFile(join(appDataDir, "workspace.json"), "utf8"),
    ).rejects.toThrow();
  });

  test("rejects a file", async () => {
    const root = await testDirectory("file");
    const appDataDir = await testDirectory("app-data");
    const file = join(root, "workspace.txt");
    await writeFile(file, "not a directory");

    const selected = await new WorkspaceService(appDataDir).select(file);
    expect(selected).toBeInstanceOf(WorkspaceNotDirectoryError);
  });

  test("rejects a missing path", async () => {
    const root = await testDirectory("missing");
    const appDataDir = await testDirectory("app-data");

    const selected = await new WorkspaceService(appDataDir).select(
      join(root, "missing"),
    );
    expect(selected).toBeInstanceOf(WorkspaceIoError);
  });

  test("resolves a selected symlink", async () => {
    const root = await testDirectory("symlink-root");
    const parent = await testDirectory("symlink-parent");
    const appDataDir = await testDirectory("app-data");
    const link = join(parent, "workspace");
    await symlink(root, link);

    const selected = await new WorkspaceService(appDataDir).select(link);
    expect(selected).not.toBeInstanceOf(Error);
    if (selected instanceof Error) return;
    expect(selected.workspaceRoot).toBe(await realpath(root));
  });

  test("allows selecting the same directory again and switching to another", async () => {
    const first = await testDirectory("first");
    const second = await testDirectory("second");
    const appDataDir = await testDirectory("app-data");
    const service = new WorkspaceService(appDataDir);
    const initial = await service.select(first);
    expect(initial).not.toBeInstanceOf(Error);

    await expect(service.select(first)).resolves.toMatchObject({
      workspaceRoot: await realpath(first),
    });

    const switched = await service.select(second);
    expect(switched).not.toBeInstanceOf(Error);
    if (switched instanceof Error) return;
    expect(switched.workspaceRoot).toBe(await realpath(second));
    expect(service.getLayout()).toMatchObject({
      root: await realpath(second),
    });
    expect(
      JSON.parse(await readFile(join(appDataDir, "workspace.json"), "utf8")),
    ).toEqual({ workspaceRoot: await realpath(second) });
  });

  test("listPaths returns relative POSIX paths and skips hidden entries", async () => {
    const root = await testDirectory("list-paths");
    const appDataDir = await testDirectory("app-data");
    await mkdir(join(root, "src", "renderer"), { recursive: true });
    await mkdir(join(root, "empty-dir"), { recursive: true });
    await mkdir(join(root, ".hidden"), { recursive: true });
    await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
    await writeFile(join(root, "src", "renderer", "App.tsx"), "export {};\n");
    await writeFile(join(root, "package.json"), "{}\n");
    await writeFile(join(root, ".hidden", "secret.txt"), "nope\n");
    await writeFile(join(root, "node_modules", "pkg", "index.js"), "ok\n");
    await writeFile(join(root, ".env"), "SECRET=1\n");

    const outside = await testDirectory("outside");
    await symlink(outside, join(root, "outside-link"));

    const service = new WorkspaceService(appDataDir);
    const selected = await service.select(root);
    expect(selected).not.toBeInstanceOf(Error);

    const paths = await service.listPaths();
    expect(paths).not.toBeInstanceOf(Error);
    if (paths instanceof Error) return;

    expect(paths.toSorted()).toEqual(
      ["empty-dir/", "package.json", "src/renderer/App.tsx"].toSorted(),
    );
  });

  test("listPaths returns WorkspaceNotReadyError before select", async () => {
    const appDataDir = await testDirectory("app-data");
    const paths = await new WorkspaceService(appDataDir).listPaths();
    expect(paths).toBeInstanceOf(WorkspaceNotReadyError);
  });
});

describe("workspace path helpers", () => {
  test("shouldSkipEntryName hides dotfiles and node_modules", () => {
    expect(shouldSkipEntryName(".git")).toBe(true);
    expect(shouldSkipEntryName(".env")).toBe(true);
    expect(shouldSkipEntryName("node_modules")).toBe(true);
    expect(shouldSkipEntryName("src")).toBe(false);
  });

  test("isSkippedRelativePath checks every segment", () => {
    expect(isSkippedRelativePath(".hidden/file.txt")).toBe(true);
    expect(isSkippedRelativePath("src/.cache/x")).toBe(true);
    expect(isSkippedRelativePath("src/App.tsx")).toBe(false);
  });

  test("toPosixRelative rejects paths outside the root", async () => {
    const root = await testDirectory("rel-root");
    const outside = await testDirectory("rel-outside");
    expect(toPosixRelative(root, join(root, "a", "b.txt"))).toBe("a/b.txt");
    expect(toPosixRelative(root, outside)).toBeUndefined();
  });

  test("mapParcelEventsToTreeEvents drops updates and maps create/delete", async () => {
    const root = await testDirectory("watch-map");
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "a.ts"), "a\n");
    const directories = directoryPathsFromList(["src/"]);

    await writeFile(join(root, "src", "b.ts"), "b\n");
    const mapped = await mapParcelEventsToTreeEvents(
      root,
      [
        { type: "update", path: join(root, "src", "a.ts") },
        { type: "create", path: join(root, "src", "b.ts") },
        { type: "delete", path: join(root, "src", "a.ts") },
        { type: "create", path: join(root, ".env") },
      ],
      directories,
    );

    expect(mapped).toEqual([
      { type: "create", path: "src/b.ts" },
      { type: "delete", path: "src/a.ts" },
    ]);
  });
});
