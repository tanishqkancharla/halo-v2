import { dirname, join } from "node:path";
import * as errore from "errore";
import haloPluginSkill from "./haloPluginSkill.md?raw";
import pluginExamplesReference from "./haloPluginReferences/examples.md?raw";
import pluginServerReference from "./haloPluginReferences/server.md?raw";
import pluginStorageReference from "./haloPluginReferences/storage.md?raw";
import pluginViewReference from "./haloPluginReferences/view.md?raw";
import type { WorkspaceLayout } from "../workspace/WorkspaceService.js";
import type { FilesystemService } from "../filesystem/FilesystemService.js";

export class PluginSeedError extends errore.createTaggedError({
  name: "PluginSeedError",
  message: "Failed to seed workspace plugins",
}) {}

export async function seedPluginWorkspace(
  filesystem: FilesystemService,
  layout: WorkspaceLayout,
  args: { appVersion: string; alwaysWrite: boolean },
) {
  const pluginSkillPath = join(
    layout.agentDir,
    "skills",
    "halo-plugin",
    "SKILL.md",
  );
  const removedMauiSkill = await filesystem.remove(
    join(layout.agentDir, "skills", "maui"),
    { recursive: true, force: true },
  );
  if (removedMauiSkill instanceof Error) {
    return new PluginSeedError({ cause: removedMauiSkill });
  }
  const pluginSkill = await writeIfStale({
    filesystem,
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
      filesystem,
      path: join(dirname(pluginSkillPath), "references", name),
      contents,
    });
    if (reference instanceof Error) return reference;
  }
}

async function writeSeedFile(args: {
  filesystem: FilesystemService;
  path: string;
  contents: string;
}) {
  const created = await args.filesystem.makeDirectory(dirname(args.path), {
    recursive: true,
  });
  if (created instanceof Error) return new PluginSeedError({ cause: created });
  const written = await args.filesystem.writeFile(args.path, args.contents);
  if (written instanceof Error) return new PluginSeedError({ cause: written });
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
  filesystem: FilesystemService;
  path: string;
  contents: string;
  appVersion: string;
  alwaysWrite: boolean;
}) {
  const stamped = stampSkillVersion(args.contents, args.appVersion);
  if (!args.alwaysWrite && args.filesystem.exists(args.path)) {
    const existing = await args.filesystem.readTextFile(args.path);
    if (existing instanceof Error) {
      return new PluginSeedError({ cause: existing });
    }
    if (readSkillVersion(existing) === args.appVersion) return;
  }
  const created = await args.filesystem.makeDirectory(dirname(args.path), {
    recursive: true,
  });
  if (created instanceof Error) return new PluginSeedError({ cause: created });
  const written = await args.filesystem.writeFile(args.path, stamped);
  if (written instanceof Error) return new PluginSeedError({ cause: written });
}
