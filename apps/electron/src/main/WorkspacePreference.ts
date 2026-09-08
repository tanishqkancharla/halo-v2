import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import type { FilesystemService } from "@get-halo/server/filesystem";

class WorkspaceIoError extends errore.createTaggedError({
  name: "WorkspaceIoError",
  message: "Workspace preference I/O failed",
}) {}

type WorkspacePreference = { workspaceRoot: string };
const workspacePreferenceSchema = Type.Object({
  workspaceRoot: Type.String({ minLength: 1 }),
});

function preferencePath(appDataDir: string): string {
  return join(appDataDir, "workspace.json");
}

export async function readWorkspacePreference(
  filesystem: FilesystemService,
  appDataDir: string,
) {
  const path = preferencePath(appDataDir);
  if (!filesystem.exists(path)) return undefined;

  const raw = await filesystem.readFile(path, "utf8");
  if (raw instanceof Error) return new WorkspaceIoError({ cause: raw });

  const parsed = errore.try({
    try: () => {
      // SAFETY: JSON.parse is untyped; workspacePreferenceSchema is the file contract.
      return JSON.parse(raw) as unknown;
    },
    catch: (e) => new WorkspaceIoError({ cause: e }),
  });
  if (parsed instanceof Error) {
    console.warn("Invalid workspace preference JSON:", parsed.message);
    const cleared = await clearWorkspacePreference(filesystem, appDataDir);
    if (cleared instanceof Error) {
      console.warn("Could not clear workspace preference:", cleared.message);
    }
    return undefined;
  }

  if (!Value.Check(workspacePreferenceSchema, parsed)) {
    const cleared = await clearWorkspacePreference(filesystem, appDataDir);
    if (cleared instanceof Error) {
      console.warn("Could not clear workspace preference:", cleared.message);
    }
    return undefined;
  }
  return { workspaceRoot: parsed.workspaceRoot };
}

export async function writeWorkspacePreference(
  filesystem: FilesystemService,
  appDataDir: string,
  workspaceRoot: string,
) {
  const created = await filesystem.makeDirectory(appDataDir, {
    recursive: true,
    mode: 0o700,
  });
  if (created instanceof Error) return new WorkspaceIoError({ cause: created });

  const preference: WorkspacePreference = { workspaceRoot };
  const written = await filesystem.writeFile(
    preferencePath(appDataDir),
    `${JSON.stringify(preference, undefined, 2)}\n`,
    { mode: 0o600 },
  );
  if (written instanceof Error) return new WorkspaceIoError({ cause: written });
}

async function clearWorkspacePreference(
  filesystem: FilesystemService,
  appDataDir: string,
) {
  const path = preferencePath(appDataDir);
  if (!filesystem.exists(path)) return;
  const removed = await filesystem.remove(path);
  if (removed instanceof Error) return new WorkspaceIoError({ cause: removed });
}
