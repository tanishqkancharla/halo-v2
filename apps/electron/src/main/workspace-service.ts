import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join } from "node:path";
import * as errore from "errore";

export type WorkspaceLayout = {
  root: string;
  agentDir: string;
  sessionDir: string;
};

export type WorkspaceInfo = {
  name: string;
  workspaceRoot: string;
};

export class WorkspaceNotReadyError extends errore.createTaggedError({
  name: "WorkspaceNotReadyError",
  message: "Choose a workspace first.",
}) {}

export class WorkspaceNotDirectoryError extends errore.createTaggedError({
  name: "WorkspaceNotDirectoryError",
  message: "The selected workspace must be a directory.",
}) {}

export class WorkspaceIoError extends errore.createTaggedError({
  name: "WorkspaceIoError",
  message: "Workspace I/O failed",
}) {}

type WorkspaceState =
  | { status: "notStarted" }
  | { status: "ready"; layout: WorkspaceLayout };

type WorkspacePreference = {
  workspaceRoot: string;
};

const preferenceFileName = "workspace.json";

export class WorkspaceService {
  private state: WorkspaceState = { status: "notStarted" };

  constructor(private readonly appDataDir: string) {}

  getWorkspace(): WorkspaceInfo | null {
    if (this.state.status === "notStarted") return null;
    return workspaceInfo(this.state.layout);
  }

  getLayout() {
    if (this.state.status === "notStarted") return new WorkspaceNotReadyError();
    return this.state.layout;
  }

  async restore() {
    const preference = await readWorkspacePreference(this.appDataDir);
    if (preference instanceof Error) {
      console.warn("Workspace preference unreadable:", preference.message);
      return null;
    }
    if (preference === null) return null;

    // Saved path may have been deleted since the last launch.
    const selected = await this.select(preference.workspaceRoot);
    if (selected instanceof Error) {
      console.warn("Saved workspace unavailable:", selected.message);
      const cleared = await clearWorkspacePreference(this.appDataDir);
      if (cleared instanceof Error) {
        console.warn("Could not clear workspace preference:", cleared.message);
      }
      return null;
    }
    return selected;
  }

  async select(directory: string) {
    const root = await realpath(directory).catch(
      (e) => new WorkspaceIoError({ cause: e }),
    );
    if (root instanceof Error) return root;

    const metadata = await stat(root).catch(
      (e) => new WorkspaceIoError({ cause: e }),
    );
    if (metadata instanceof Error) return metadata;
    if (!metadata.isDirectory()) return new WorkspaceNotDirectoryError();

    const layout = workspaceLayout(root);
    if (
      this.state.status === "ready" &&
      this.state.layout.root === layout.root
    ) {
      return workspaceInfo(this.state.layout);
    }

    const sessionDir = await mkdir(layout.sessionDir, {
      recursive: true,
      mode: 0o700,
    }).catch((e) => new WorkspaceIoError({ cause: e }));
    if (sessionDir instanceof Error) return sessionDir;

    const preference = await writeWorkspacePreference(this.appDataDir, root);
    if (preference instanceof Error) return preference;

    this.state = { status: "ready", layout };
    return workspaceInfo(layout);
  }
}

function workspaceLayout(root: string): WorkspaceLayout {
  const agentDir = join(root, ".pi", "agent");
  return {
    root,
    agentDir,
    sessionDir: join(agentDir, "sessions"),
  };
}

function workspaceInfo(layout: WorkspaceLayout): WorkspaceInfo {
  return {
    name: basename(layout.root),
    workspaceRoot: layout.root,
  };
}

function preferencePath(appDataDir: string): string {
  return join(appDataDir, preferenceFileName);
}

async function readWorkspacePreference(appDataDir: string) {
  const path = preferencePath(appDataDir);
  if (!existsSync(path)) return null;

  const raw = await readFile(path, "utf8").catch(
    (e) => new WorkspaceIoError({ cause: e }),
  );
  if (raw instanceof Error) return raw;

  const parsed = errore.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (e) => new WorkspaceIoError({ cause: e }),
  });
  if (parsed instanceof Error) {
    console.warn("Invalid workspace preference JSON:", parsed.message);
    const cleared = await clearWorkspacePreference(appDataDir);
    if (cleared instanceof Error) {
      console.warn("Could not clear workspace preference:", cleared.message);
    }
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("workspaceRoot" in parsed) ||
    typeof parsed.workspaceRoot !== "string"
  ) {
    const cleared = await clearWorkspacePreference(appDataDir);
    if (cleared instanceof Error) {
      console.warn("Could not clear workspace preference:", cleared.message);
    }
    return null;
  }
  return { workspaceRoot: parsed.workspaceRoot };
}

async function writeWorkspacePreference(
  appDataDir: string,
  workspaceRoot: string,
) {
  const created = await mkdir(appDataDir, {
    recursive: true,
    mode: 0o700,
  }).catch((e) => new WorkspaceIoError({ cause: e }));
  if (created instanceof Error) return created;

  const preference: WorkspacePreference = { workspaceRoot };
  const written = await writeFile(
    preferencePath(appDataDir),
    `${JSON.stringify(preference, null, 2)}\n`,
    { mode: 0o600 },
  ).catch((e) => new WorkspaceIoError({ cause: e }));
  if (written instanceof Error) return written;
}

async function clearWorkspacePreference(appDataDir: string) {
  const path = preferencePath(appDataDir);
  if (!existsSync(path)) return;
  const removed = await rm(path).catch(
    (e) => new WorkspaceIoError({ cause: e }),
  );
  if (removed instanceof Error) return removed;
}
