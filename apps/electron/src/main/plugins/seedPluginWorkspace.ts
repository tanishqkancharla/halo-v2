import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import * as errore from "errore";
import haloPluginSkill from "./haloPluginSkill.md?raw";
import pluginExamplesReference from "./haloPluginReferences/examples.md?raw";
import pluginServerReference from "./haloPluginReferences/server.md?raw";
import pluginStorageReference from "./haloPluginReferences/storage.md?raw";
import pluginViewReference from "./haloPluginReferences/view.md?raw";
import type { WorkspaceLayout } from "../workspace/WorkspaceService.js";

const require = createRequire(import.meta.url);

export class PluginSeedError extends errore.createTaggedError({
  name: "PluginSeedError",
  message: "Failed to seed workspace plugins",
}) {}

export async function seedPluginWorkspace(
  layout: WorkspaceLayout,
  args: { appVersion: string; alwaysWrite: boolean },
) {
  const pluginSkillPath = join(
    layout.agentDir,
    "skills",
    "halo-plugin",
    "SKILL.md",
  );
  const mauiSkillPath = join(layout.agentDir, "skills", "maui", "SKILL.md");
  const mauiRoot = dirname(require.resolve("maui/package.json"));
  const mauiSkill = await readFile(
    join(mauiRoot, "skills", "maui", "SKILL.md"),
    "utf8",
  ).catch((e) => new PluginSeedError({ cause: e }));
  if (mauiSkill instanceof Error) return mauiSkill;
  const pluginSkill = await writeIfStale({
    path: pluginSkillPath,
    contents: haloPluginSkill,
    appVersion: args.appVersion,
    alwaysWrite: args.alwaysWrite,
  });
  if (pluginSkill instanceof Error) return pluginSkill;
  const pluginReferences = [
    ["examples.md", pluginExamplesReference],
    ["server.md", pluginServerReference],
    ["storage.md", pluginStorageReference],
    ["view.md", pluginViewReference],
  ] as const;
  for (const [name, contents] of pluginReferences) {
    const reference = await writeSeedFile({
      path: join(dirname(pluginSkillPath), "references", name),
      contents,
    });
    if (reference instanceof Error) return reference;
  }
  const mauiSkillWritten = await writeIfStale({
    path: mauiSkillPath,
    contents: mauiSkill,
    appVersion: args.appVersion,
    alwaysWrite: args.alwaysWrite,
  });
  if (mauiSkillWritten instanceof Error) return mauiSkillWritten;
  const referencesRoot = join(dirname(mauiSkillPath), "src");
  for (const directory of ["apps", "patterns"]) {
    const copied = await cp(
      join(mauiRoot, "src", directory),
      join(referencesRoot, directory),
      { recursive: true, force: true },
    ).catch((e) => new PluginSeedError({ cause: e }));
    if (copied instanceof Error) return copied;
  }
}

async function writeSeedFile(args: { path: string; contents: string }) {
  const created = await mkdir(dirname(args.path), { recursive: true }).catch(
    (e) => new PluginSeedError({ cause: e }),
  );
  if (created instanceof Error) return created;
  const written = await writeFile(args.path, args.contents).catch(
    (e) => new PluginSeedError({ cause: e }),
  );
  if (written instanceof Error) return written;
}

function stampSkillVersion(contents: string, version: string) {
  if (!contents.startsWith("---\n")) {
    return `---\nversion: ${version}\n---\n${contents}`;
  }
  const end = contents.indexOf("\n---\n", 4);
  if (end === -1) {
    return `---\nversion: ${version}\n---\n${contents}`;
  }
  const matter = contents.slice(4, end).replace(/^version:.*\n?/m, "");
  return `---\nversion: ${version}\n${matter}${contents.slice(end)}`;
}

function readSkillVersion(contents: string) {
  if (!contents.startsWith("---\n")) return undefined;
  const end = contents.indexOf("\n---\n", 4);
  if (end === -1) return undefined;
  const match = /^version:\s*(\S+)\s*$/m.exec(contents.slice(4, end));
  if (match === null) return undefined;
  return match[1];
}

async function writeIfStale(args: {
  path: string;
  contents: string;
  appVersion: string;
  alwaysWrite: boolean;
}) {
  const stamped = stampSkillVersion(args.contents, args.appVersion);
  if (!args.alwaysWrite && existsSync(args.path)) {
    const existing = await readFile(args.path, "utf8").catch(
      (e) => new PluginSeedError({ cause: e }),
    );
    if (existing instanceof Error) return existing;
    if (readSkillVersion(existing) === args.appVersion) return;
  }
  const created = await mkdir(dirname(args.path), { recursive: true }).catch(
    (e) => new PluginSeedError({ cause: e }),
  );
  if (created instanceof Error) return created;
  const written = await writeFile(args.path, stamped).catch(
    (e) => new PluginSeedError({ cause: e }),
  );
  if (written instanceof Error) return written;
}
