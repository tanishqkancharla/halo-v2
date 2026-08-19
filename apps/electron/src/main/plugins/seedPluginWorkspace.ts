import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import * as errore from "errore";
import calendarPackageJson from "../bundled/calendar/package.json?raw";
import calendarView from "../bundled/calendar/view.tsx?raw";
import haloPluginSkill from "../bundled/haloPluginSkill.md?raw";
import type { WorkspaceLayout } from "../workspace-service.js";

export class PluginSeedError extends errore.createTaggedError({
  name: "PluginSeedError",
  message: "Failed to seed workspace plugins",
}) {}

export async function seedPluginWorkspace(layout: WorkspaceLayout) {
  const calendarDir = join(layout.root, ".halo", "plugins", "calendar");
  const skillPath = join(layout.agentDir, "skills", "halo-plugin", "SKILL.md");
  const packageJson = await writeIfMissing(
    join(calendarDir, "package.json"),
    calendarPackageJson,
  );
  if (packageJson instanceof Error) return packageJson;
  const view = await writeIfMissing(
    join(calendarDir, "view.tsx"),
    calendarView,
  );
  if (view instanceof Error) return view;
  return writeIfMissing(skillPath, haloPluginSkill);
}

async function writeIfMissing(path: string, contents: string) {
  if (existsSync(path)) return;
  const created = await mkdir(dirname(path), { recursive: true }).catch(
    (e) => new PluginSeedError({ cause: e }),
  );
  if (created instanceof Error) return created;
  const written = await writeFile(path, contents).catch(
    (e) => new PluginSeedError({ cause: e }),
  );
  if (written instanceof Error) return written;
}
