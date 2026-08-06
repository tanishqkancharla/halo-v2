import { mkdir, realpath, stat } from "node:fs/promises";
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

export class WorkspaceService {
  private state: WorkspaceState = { status: "notStarted" };

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
