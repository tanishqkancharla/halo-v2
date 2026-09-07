import { dirname, join } from "node:path";
import * as errore from "errore";
import haloExtensionSkill from "./haloExtensionSkill.md?raw";
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
  const skillsDirectory = join(layout.agentDir, "skills");
  for (const name of ["halo-plugin", "maui"]) {
    const removed = await filesystem.remove(join(skillsDirectory, name), {
      recursive: true,
      force: true,
    });
    if (removed instanceof Error)
      return new ExtensionSeedError({ cause: removed });
  }

  const path = join(skillsDirectory, "halo-extension", "SKILL.md");
  if (filesystem.exists(path)) {
    const existing = await filesystem.readFile(path, "utf8");
    if (existing instanceof Error)
      return new ExtensionSeedError({ cause: existing });
    if (existing === haloExtensionSkill) return;
  }
  const created = await filesystem.makeDirectory(dirname(path), {
    recursive: true,
  });
  if (created instanceof Error)
    return new ExtensionSeedError({ cause: created });
  const written = await filesystem.writeFile(path, haloExtensionSkill);
  if (written instanceof Error)
    return new ExtensionSeedError({ cause: written });
}
