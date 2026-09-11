import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import * as errore from "errore";
import type { WorkspaceLayout } from "../workspace/WorkspaceService.js";
import type { FilesystemService } from "../filesystem/FilesystemService.js";

export class ExtensionSeedError extends errore.createTaggedError({
  name: "ExtensionSeedError",
  message: "Failed to seed workspace extension guidance",
}) {}

export async function seedExtensionWorkspace(
  filesystem: FilesystemService,
  layout: WorkspaceLayout,
) {
  const skillsDirectory = join(layout.root, ".agents", "skills");
  for (const name of ["halo-extension", "maui"]) {
    const removed = await filesystem.remove(
      join(layout.agentDir, "skills", name),
      {
        recursive: true,
        force: true,
      },
    );
    if (removed instanceof Error)
      return new ExtensionSeedError({ cause: removed });
  }

  const haloExtensionSkill = await filesystem.readFile(
    join(import.meta.dirname, "haloExtensionSkill.md"),
    "utf8",
  );
  if (haloExtensionSkill instanceof Error)
    return new ExtensionSeedError({ cause: haloExtensionSkill });
  const maui = await filesystem.readFile(mauiSkillPath(), "utf8");
  if (maui instanceof Error) return new ExtensionSeedError({ cause: maui });
  for (const [name, contents] of [
    ["halo-extension", haloExtensionSkill],
    ["maui", maui],
  ] as const) {
    const written = await writeSkill(
      filesystem,
      join(skillsDirectory, name, "SKILL.md"),
      contents,
    );
    if (written instanceof Error) return written;
  }
}

function mauiSkillPath() {
  const require = createRequire(import.meta.url);
  return join(
    dirname(require.resolve("maui/package.json")),
    "skills",
    "maui",
    "SKILL.md",
  );
}

async function writeSkill(
  filesystem: FilesystemService,
  path: string,
  contents: string,
) {
  if (filesystem.exists(path)) {
    const existing = await filesystem.readFile(path, "utf8");
    if (existing instanceof Error)
      return new ExtensionSeedError({ cause: existing });
    if (existing === contents) return;
  }
  const created = await filesystem.makeDirectory(dirname(path), {
    recursive: true,
  });
  if (created instanceof Error)
    return new ExtensionSeedError({ cause: created });
  const written = await filesystem.writeFile(path, contents);
  if (written instanceof Error)
    return new ExtensionSeedError({ cause: written });
}
