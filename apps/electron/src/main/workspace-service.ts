import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import * as watcher from "@parcel/watcher";
import * as errore from "errore";
import type { WorkspaceTreeEvent } from "../shared/rpc.js";

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

type TreeListener = (events: WorkspaceTreeEvent[]) => void;

const preferenceFileName = "workspace.json";

/** Finder-hidden names (leading `.`) plus `node_modules` for walk cost. */
export function shouldSkipEntryName(name: string): boolean {
  if (name.startsWith(".")) return true;
  return name === "node_modules";
}

export function isSkippedRelativePath(relativePath: string): boolean {
  for (const segment of relativePath.split("/")) {
    if (segment.length === 0) continue;
    if (shouldSkipEntryName(segment)) return true;
  }
  return false;
}

export function toPosixRelative(
  workspaceRoot: string,
  absolutePath: string,
): string | undefined {
  const rel = relative(workspaceRoot, absolutePath);
  if (rel.length === 0) return undefined;
  if (rel === "..") return undefined;
  if (rel.startsWith(`..${sep}`)) return undefined;
  return rel.split(sep).join("/");
}

export const parcelWatcherIgnore = [
  "**/node_modules/**",
  "**/.*",
  "**/.*/**",
] as const;

export type ParcelWatchEvent = {
  type: "create" | "update" | "delete";
  path: string;
};

export async function mapParcelEventsToTreeEvents(
  workspaceRoot: string,
  events: readonly ParcelWatchEvent[],
  directoryPaths: Set<string>,
): Promise<WorkspaceTreeEvent[]> {
  const mapped: WorkspaceTreeEvent[] = [];

  for (const event of events) {
    if (event.type === "update") continue;

    const relativePath = toPosixRelative(workspaceRoot, event.path);
    if (relativePath === undefined) continue;
    if (isSkippedRelativePath(relativePath)) continue;

    if (event.type === "delete") {
      const directoryPath = relativePath.endsWith("/")
        ? relativePath
        : `${relativePath}/`;
      if (directoryPaths.has(directoryPath)) {
        mapped.push({ type: "delete", path: directoryPath });
        removeDirectoryAndDescendants(directoryPaths, directoryPath);
        continue;
      }
      mapped.push({ type: "delete", path: relativePath });
      continue;
    }

    const metadata = await stat(event.path).catch(
      (e) => new WorkspaceIoError({ cause: e }),
    );
    if (metadata instanceof Error) continue;
    if (metadata.isDirectory()) {
      const directoryPath = relativePath.endsWith("/")
        ? relativePath
        : `${relativePath}/`;
      directoryPaths.add(directoryPath);
      mapped.push({ type: "create", path: directoryPath });
      continue;
    }
    if (metadata.isFile()) {
      mapped.push({ type: "create", path: relativePath });
    }
  }

  return mapped;
}

export function directoryPathsFromList(paths: readonly string[]): Set<string> {
  const directories = new Set<string>();
  for (const path of paths) {
    if (path.endsWith("/")) directories.add(path);
  }
  return directories;
}

function removeDirectoryAndDescendants(
  directoryPaths: Set<string>,
  directoryPath: string,
) {
  for (const known of Array.from(directoryPaths)) {
    if (known === directoryPath || known.startsWith(directoryPath)) {
      directoryPaths.delete(known);
    }
  }
}

export class WorkspaceService {
  private state: WorkspaceState = { status: "notStarted" };
  private treeListener: TreeListener | undefined;
  private watchSubscription: watcher.AsyncSubscription | undefined;
  private directoryPaths = new Set<string>();

  constructor(private readonly appDataDir: string) {}

  getWorkspace(): WorkspaceInfo | undefined {
    if (this.state.status === "notStarted") return undefined;
    return workspaceInfo(this.state.layout);
  }

  getLayout() {
    if (this.state.status === "notStarted") return new WorkspaceNotReadyError();
    return this.state.layout;
  }

  async listPaths() {
    const layout = this.getLayout();
    if (layout instanceof Error) return layout;
    const paths = await listRelativeWorkspacePaths(layout.root);
    if (paths instanceof Error) return paths;
    this.directoryPaths = directoryPathsFromList(paths);
    return paths;
  }

  setTreeListener(listener: TreeListener | undefined) {
    this.treeListener = listener;
  }

  async restore() {
    const preference = await readWorkspacePreference(this.appDataDir);
    if (preference instanceof Error) {
      console.warn("Workspace preference unreadable:", preference.message);
      return undefined;
    }
    if (preference === undefined) return undefined;

    // Saved path may have been deleted since the last launch.
    const selected = await this.select(preference.workspaceRoot);
    if (selected instanceof Error) {
      console.warn("Saved workspace unavailable:", selected.message);
      const cleared = await clearWorkspacePreference(this.appDataDir);
      if (cleared instanceof Error) {
        console.warn("Could not clear workspace preference:", cleared.message);
      }
      return undefined;
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

    await this.stopWatch();
    this.state = { status: "ready", layout };
    this.directoryPaths = new Set();
    await this.startWatch(layout.root);
    return workspaceInfo(layout);
  }

  private async startWatch(root: string) {
    const subscription = await watcher
      .subscribe(
        root,
        (err, events) => {
          if (err !== null) {
            console.warn("Workspace watch error:", err.message);
            return;
          }
          void this.handleWatchEvents(root, events);
        },
        { ignore: [...parcelWatcherIgnore] },
      )
      .catch((e) => new WorkspaceIoError({ cause: e }));
    if (subscription instanceof Error) {
      console.warn("Workspace watch failed to start:", subscription.message);
      return;
    }
    this.watchSubscription = subscription;
  }

  private async stopWatch() {
    const subscription = this.watchSubscription;
    this.watchSubscription = undefined;
    if (subscription === undefined) return;
    const stopped = await subscription
      .unsubscribe()
      .catch((e) => new WorkspaceIoError({ cause: e }));
    if (stopped instanceof Error) {
      console.warn("Workspace watch stop failed:", stopped.message);
    }
  }

  private async handleWatchEvents(
    root: string,
    events: readonly watcher.Event[],
  ) {
    const mapped = await mapParcelEventsToTreeEvents(
      root,
      events,
      this.directoryPaths,
    );
    if (mapped.length === 0) return;
    const listener = this.treeListener;
    if (listener === undefined) return;
    listener(mapped);
  }
}

async function listRelativeWorkspacePaths(workspaceRoot: string) {
  const paths: string[] = [];
  const walked = await walkDirectory(workspaceRoot, "", paths);
  if (walked instanceof Error) return walked;
  return paths;
}

async function walkDirectory(
  absoluteDir: string,
  relativeDir: string,
  paths: string[],
): Promise<void | WorkspaceIoError> {
  const entries = await readdir(absoluteDir, { withFileTypes: true }).catch(
    (e) => new WorkspaceIoError({ cause: e }),
  );
  if (entries instanceof Error) return entries;

  const included = entries.filter((entry) => {
    if (shouldSkipEntryName(entry.name)) return false;
    if (entry.isSymbolicLink()) return false;
    return entry.isFile() || entry.isDirectory();
  });

  if (relativeDir.length > 0 && included.length === 0) {
    paths.push(`${relativeDir}/`);
    return;
  }

  for (const entry of included) {
    const childAbsolute = join(absoluteDir, entry.name);
    const childRelative =
      relativeDir.length === 0 ? entry.name : `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      const walked: void | WorkspaceIoError = await walkDirectory(
        childAbsolute,
        childRelative,
        paths,
      );
      if (walked instanceof Error) return walked;
      continue;
    }
    paths.push(childRelative);
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
  if (!existsSync(path)) return undefined;

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
    return undefined;
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
    return undefined;
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
    `${JSON.stringify(preference, undefined, 2)}\n`,
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
