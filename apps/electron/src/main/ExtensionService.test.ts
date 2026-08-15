import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  ExtensionService,
  workspaceExtensionSkillFile,
  workspaceExtensionsDir,
} from "./ExtensionService.ts";
import {
  calendarExtensionSource,
  haloExtensionSkillMarkdown,
} from "./bundledExtensions.ts";
import {
  WorkspaceNotReadyError,
  WorkspaceService,
} from "./workspace-service.ts";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repoSkillPath = join(
  currentDirectory,
  "../../../../.agents/skills/halo-extension/SKILL.md",
);
const bundledSkillPath = join(
  currentDirectory,
  "bundled/haloExtensionSkill.md",
);

async function testDirectory(name: string) {
  return mkdtemp(join(tmpdir(), `halo-${name}-`));
}

describe("ExtensionService", () => {
  test("list returns WorkspaceNotReadyError before select", async () => {
    const appDataDir = await testDirectory("app-data");
    const listed = await new ExtensionService(
      new WorkspaceService(appDataDir),
    ).list();
    expect(listed).toBeInstanceOf(WorkspaceNotReadyError);
  });

  test("seeds calendar and the halo-extension skill once", async () => {
    const root = await testDirectory("workspace");
    const appDataDir = await testDirectory("app-data");
    const workspace = new WorkspaceService(appDataDir);
    const selected = await workspace.select(root);
    expect(selected).not.toBeInstanceOf(Error);

    const service = new ExtensionService(workspace);
    const bundle = await service.list();
    expect(bundle).not.toBeInstanceOf(Error);
    if (bundle instanceof Error) return;

    expect(bundle.errors).toEqual([]);
    expect(bundle.extensions.map((extension) => extension.id)).toEqual([
      "calendar",
    ]);

    const calendarPath = join(
      workspaceExtensionsDir(root),
      "calendar",
      "index.tsx",
    );
    expect(await readFile(calendarPath, "utf8")).toBe(calendarExtensionSource);

    const layout = workspace.getLayout();
    if (layout instanceof Error) return;
    const skillPath = workspaceExtensionSkillFile(layout.agentDir);
    expect(await readFile(skillPath, "utf8")).toBe(haloExtensionSkillMarkdown);

    await writeFile(calendarPath, "// edited\n");
    const again = await service.list();
    expect(again).not.toBeInstanceOf(Error);
    expect(await readFile(calendarPath, "utf8")).toBe("// edited\n");
  });

  test("reports a compile error without dropping other extensions", async () => {
    const root = await testDirectory("workspace");
    const appDataDir = await testDirectory("app-data");
    const workspace = new WorkspaceService(appDataDir);
    const selected = await workspace.select(root);
    expect(selected).not.toBeInstanceOf(Error);

    const brokenDir = join(workspaceExtensionsDir(root), "broken");
    await mkdir(brokenDir, { recursive: true });
    await writeFile(join(brokenDir, "index.tsx"), "export default {");

    const bundle = await new ExtensionService(workspace).list();
    expect(bundle).not.toBeInstanceOf(Error);
    if (bundle instanceof Error) return;
    expect(bundle.extensions.map((extension) => extension.id)).toEqual([
      "calendar",
    ]);
    expect(bundle.errors[0]?.id).toBe("broken");
  });
});

describe("bundled halo-extension skill", () => {
  test("matches the repo skill file", async () => {
    const repoSkill = await readFile(repoSkillPath, "utf8");
    const bundledSkill = await readFile(bundledSkillPath, "utf8");
    expect(bundledSkill).toBe(repoSkill);
    expect(haloExtensionSkillMarkdown).toBe(repoSkill);
  });
});
