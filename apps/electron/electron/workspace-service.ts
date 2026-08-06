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

export type WorkspaceLayout = {
  root: string;
  agentDir: string;
  sessionDir: string;
};

export type WorkspaceInfo = {
  name: string;
  workspaceRoot: string;
};

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

  getLayout(): WorkspaceLayout {
    if (this.state.status === "notStarted") {
      throw new Error("Choose a workspace first.");
    }
    return this.state.layout;
  }

  async restore(): Promise<WorkspaceInfo | null> {
    const preference = await readWorkspacePreference(this.appDataDir);
    if (preference === null) return null;
    // Saved path may have been deleted since the last launch.
    try {
      return await this.select(preference.workspaceRoot);
    } catch {
      await clearWorkspacePreference(this.appDataDir);
      return null;
    }
  }

  async select(directory: string): Promise<WorkspaceInfo> {
    const root = await realpath(directory);
    const metadata = await stat(root);
    if (!metadata.isDirectory()) {
      throw new Error("The selected workspace must be a directory.");
    }

    const layout = workspaceLayout(root);
    if (this.state.status === "ready") {
      if (this.state.layout.root !== layout.root) {
        throw new Error("A workspace has already been selected.");
      }
      return workspaceInfo(this.state.layout);
    }

    await mkdir(layout.sessionDir, { recursive: true, mode: 0o700 });
    await writeWorkspacePreference(this.appDataDir, root);
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

async function readWorkspacePreference(
  appDataDir: string,
): Promise<WorkspacePreference | null> {
  const path = preferencePath(appDataDir);
  if (!existsSync(path)) return null;
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("workspaceRoot" in parsed) ||
    typeof parsed.workspaceRoot !== "string"
  ) {
    await clearWorkspacePreference(appDataDir);
    return null;
  }
  return { workspaceRoot: parsed.workspaceRoot };
}

async function writeWorkspacePreference(
  appDataDir: string,
  workspaceRoot: string,
): Promise<void> {
  await mkdir(appDataDir, { recursive: true, mode: 0o700 });
  const preference: WorkspacePreference = { workspaceRoot };
  await writeFile(
    preferencePath(appDataDir),
    `${JSON.stringify(preference, null, 2)}\n`,
    { mode: 0o600 },
  );
}

async function clearWorkspacePreference(appDataDir: string): Promise<void> {
  const path = preferencePath(appDataDir);
  if (!existsSync(path)) return;
  await rm(path);
}
