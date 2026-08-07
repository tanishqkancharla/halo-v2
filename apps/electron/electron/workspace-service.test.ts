import {
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
  WorkspaceAlreadySelectedError,
  WorkspaceIoError,
  WorkspaceNotDirectoryError,
  WorkspaceService,
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

  test("restore returns null when nothing is saved", async () => {
    const appDataDir = await testDirectory("app-data");

    await expect(
      new WorkspaceService(appDataDir).restore(),
    ).resolves.toBeNull();
  });

  test("restore clears a missing saved workspace", async () => {
    const root = await testDirectory("workspace");
    const appDataDir = await testDirectory("app-data");
    const selected = await new WorkspaceService(appDataDir).select(root);
    expect(selected).not.toBeInstanceOf(Error);
    await rm(root, { recursive: true, force: true });

    await expect(
      new WorkspaceService(appDataDir).restore(),
    ).resolves.toBeNull();
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

  test("allows the same directory and rejects a different one", async () => {
    const first = await testDirectory("first");
    const second = await testDirectory("second");
    const appDataDir = await testDirectory("app-data");
    const service = new WorkspaceService(appDataDir);
    const initial = await service.select(first);
    expect(initial).not.toBeInstanceOf(Error);

    await expect(service.select(first)).resolves.toMatchObject({
      workspaceRoot: await realpath(first),
    });
    const rejected = await service.select(second);
    expect(rejected).toBeInstanceOf(WorkspaceAlreadySelectedError);
  });
});
