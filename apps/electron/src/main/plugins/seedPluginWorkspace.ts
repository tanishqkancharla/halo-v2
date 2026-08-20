import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as errore from "errore";
import calendarPackageJson from "../bundled/calendar/package.json?raw";
import calendarView from "../bundled/calendar/view.tsx?raw";
import haloPluginSkill from "./haloPluginSkill.md?raw";
import mauiSkill from "../bundled/mauiSkill.md?raw";
import type { WorkspaceLayout } from "../workspace-service.js";

export class PluginSeedError extends errore.createTaggedError({
  name: "PluginSeedError",
  message: "Failed to seed workspace plugins",
}) {}

const compilePluginViewMarker = "{{HALO_COMPILE_PLUGIN_VIEW}}";
const compilePluginViewRel =
  "apps/electron/src/main/plugins/compilePluginView.ts";

export async function seedPluginWorkspace(layout: WorkspaceLayout) {
  const calendarDir = join(layout.root, ".halo", "plugins", "calendar");
  const pluginSkillPath = join(
    layout.agentDir,
    "skills",
    "halo-plugin",
    "SKILL.md",
  );
  const mauiSkillPath = join(layout.agentDir, "skills", "maui", "SKILL.md");
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
  const pluginSkill = await writeIfMissing(
    pluginSkillPath,
    skillWithHaloSourcePaths(haloPluginSkill),
  );
  if (pluginSkill instanceof Error) return pluginSkill;
  return writeIfMissing(mauiSkillPath, mauiSkill);
}

function skillWithHaloSourcePaths(skill: string) {
  const path = compilePluginViewSourcePath() ?? compilePluginViewRel;
  return skill.replaceAll(compilePluginViewMarker, path);
}

function compilePluginViewSourcePath() {
  let dir = dirname(fileURLToPath(import.meta.url));
  const sibling = join(dir, "compilePluginView.ts");
  if (existsSync(sibling)) return sibling;
  // Vite main output is `.vite/build/main.cjs`. Four parents is the repo root.
  for (let i = 0; i < 4; i += 1) {
    dir = dirname(dir);
  }
  const fromRepo = join(dir, compilePluginViewRel);
  if (existsSync(fromRepo)) return fromRepo;
  return undefined;
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
