import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as errore from "errore";
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
  const pluginSkillPath = join(
    layout.agentDir,
    "skills",
    "halo-plugin",
    "SKILL.md",
  );
  const mauiSkillPath = join(layout.agentDir, "skills", "maui", "SKILL.md");
  const pluginSkill = await writeSkill(
    pluginSkillPath,
    skillWithHaloSourcePaths(haloPluginSkill),
  );
  if (pluginSkill instanceof Error) return pluginSkill;
  return writeSkill(mauiSkillPath, mauiSkill);
}

function skillWithHaloSourcePaths(skill: string) {
  const path = compilePluginViewSourcePath();
  const resolved = path === undefined ? compilePluginViewRel : path;
  return skill.replaceAll(compilePluginViewMarker, resolved);
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

function skillFrontmatterVersion(contents: string) {
  if (!contents.startsWith("---\n")) return undefined;
  const end = contents.indexOf("\n---\n", 4);
  if (end === -1) return undefined;
  const frontmatter = contents.slice(4, end);
  const match = /^version:\s*(\d+)\s*$/m.exec(frontmatter);
  if (match === null) return undefined;
  const raw = match[1];
  if (raw === undefined) return undefined;
  return Number(raw);
}

async function writeSkill(path: string, contents: string) {
  if (existsSync(path)) {
    const existing = await readFile(path, "utf8").catch(
      (e) => new PluginSeedError({ cause: e }),
    );
    if (existing instanceof Error) return existing;
    const disk = skillFrontmatterVersion(existing);
    const next = skillFrontmatterVersion(contents);
    if (disk !== undefined && next !== undefined && disk >= next) return;
  }
  const created = await mkdir(dirname(path), { recursive: true }).catch(
    (e) => new PluginSeedError({ cause: e }),
  );
  if (created instanceof Error) return created;
  const written = await writeFile(path, contents).catch(
    (e) => new PluginSeedError({ cause: e }),
  );
  if (written instanceof Error) return written;
}
