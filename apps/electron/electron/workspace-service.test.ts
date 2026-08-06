import { mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, test } from "vitest";
import { WorkspaceService } from "./workspace-service.js";

async function testDirectory(name: string) {
  return mkdtemp(join(tmpdir(), `halo-${name}-`));
}

describe("WorkspaceService", () => {
  test("selects a directory and creates Pi session storage", async () => {
    const root = await testDirectory("workspace");
    const resolvedRoot = await realpath(root);
    const service = new WorkspaceService();

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

  test("rejects a file", async () => {
    const root = await testDirectory("file");
    const file = join(root, "workspace.txt");
    await writeFile(file, "not a directory");

    await expect(new WorkspaceService().select(file)).rejects.toThrow(
      "must be a directory",
    );
  });

  test("rejects a missing path", async () => {
    const root = await testDirectory("missing");

    await expect(
      new WorkspaceService().select(join(root, "missing")),
    ).rejects.toThrow();
  });

  test("resolves a selected symlink", async () => {
    const root = await testDirectory("symlink-root");
    const parent = await testDirectory("symlink-parent");
    const link = join(parent, "workspace");
    await symlink(root, link);

    const selected = await new WorkspaceService().select(link);

    expect(selected.workspaceRoot).toBe(await realpath(root));
  });

  test("allows the same directory and rejects a different one", async () => {
    const first = await testDirectory("first");
    const second = await testDirectory("second");
    const service = new WorkspaceService();
    await service.select(first);

    await expect(service.select(first)).resolves.toMatchObject({
      workspaceRoot: await realpath(first),
    });
    await expect(service.select(second)).rejects.toThrow(
      "already been selected",
    );
  });
});
