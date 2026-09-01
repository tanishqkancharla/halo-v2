import { basename, delimiter, join, relative, sep } from "node:path";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import type { WorkspaceTreeEvent } from "../../shared/rpc.js";
import { type ReadonlyStream, Stream } from "../../shared/Stream.js";
import {
  type FilesystemWatchBatch,
  type FilesystemWatchEvent,
  FilesystemService,
} from "../filesystem/FilesystemService.js";
import { haloCliBinDir, installHaloCli } from "./installHaloCli.js";
import { seedPluginWorkspace } from "../plugins/seedPluginWorkspace.js";

export type WorkspaceLayout = {
  root: string;
  agentDir: string;
  sessionDir: string;
};

type WorkspaceInfo = {
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

const workspacePreferenceSchema = Type.Object({
  workspaceRoot: Type.String({ minLength: 1 }),
});

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

export function mapFilesystemEventsToTreeEvents(
  workspaceRoot: string,
  events: readonly FilesystemWatchEvent[],
  directoryPaths: Set<string>,
) {
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

    if (event.kind === "directory") {
      const directoryPath = relativePath.endsWith("/")
        ? relativePath
        : `${relativePath}/`;
      directoryPaths.add(directoryPath);
      mapped.push({ type: "create", path: directoryPath });
      continue;
    }
    mapped.push({ type: "create", path: relativePath });
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

type WorkspaceServiceOptions = {
  appDataDir: string;
  filesystem: FilesystemService;
  appVersion: string;
  cliEntry?: string;
  cliNodeExecutable?: string;
  cliElectronRunAsNode?: boolean;
  isDevelopment?: boolean;
};

export class WorkspaceService {
  private state: WorkspaceState = { status: "notStarted" };
  private readonly treeEventStream = new Stream<WorkspaceTreeEvent[]>();
  readonly treeEvents: ReadonlyStream<WorkspaceTreeEvent[]> =
    this.treeEventStream;
  private readonly unsubscribeFilesystemEvents: () => void;
  private directoryPaths = new Set<string>();

  constructor(private readonly options: WorkspaceServiceOptions) {
    const watchEvents = this.options.filesystem.watchEvents.filter(
      (entry): entry is FilesystemWatchBatch => {
        if (this.state.status === "notStarted") return false;
        if (entry.watchedPath !== this.state.layout.root) return false;
        if (entry instanceof Error) {
          console.warn("Workspace watch failed:", entry.message);
          return false;
        }
        return true;
      },
    );
    this.unsubscribeFilesystemEvents = watchEvents.subscribe((batch) => {
      // oxlint-disable-next-line typescript/no-floating-promises -- Stream subscribers cannot await; later batches must not wait on filesystem refreshes.
      void this.handleWatchEvents(batch);
    });
  }

  getWorkspace(): WorkspaceInfo | undefined {
    if (this.state.status === "notStarted") return undefined;
    return workspaceInfo(this.state.layout);
  }

  get appVersion() {
    return this.options.appVersion;
  }

  getLayout() {
    if (this.state.status === "notStarted") return new WorkspaceNotReadyError();
    return this.state.layout;
  }

  async listPaths() {
    const layout = this.getLayout();
    if (layout instanceof Error) return layout;
    const paths = await listRelativeWorkspacePaths(
      this.options.filesystem,
      layout.root,
    );
    if (paths instanceof Error) return paths;
    this.directoryPaths = directoryPathsFromList(paths);
    return paths;
  }

  async restore() {
    const preference = await readWorkspacePreference(
      this.options.filesystem,
      this.options.appDataDir,
    );
    if (preference instanceof Error) {
      console.warn("Workspace preference unreadable:", preference.message);
      return undefined;
    }
    if (preference === undefined) return undefined;

    // Saved path may have been deleted since the last launch.
    const selected = await this.select(preference.workspaceRoot);
    if (selected instanceof Error) {
      console.warn("Saved workspace unavailable:", selected.message);
      const cleared = await clearWorkspacePreference(
        this.options.filesystem,
        this.options.appDataDir,
      );
      if (cleared instanceof Error) {
        console.warn("Could not clear workspace preference:", cleared.message);
      }
      return undefined;
    }
    return selected;
  }

  async select(directory: string) {
    const root = await this.options.filesystem.realpath(directory);
    if (root instanceof Error) return new WorkspaceIoError({ cause: root });

    const metadata = await this.options.filesystem.stat(root);
    if (metadata instanceof Error) {
      return new WorkspaceIoError({ cause: metadata });
    }
    if (!metadata.isDirectory()) return new WorkspaceNotDirectoryError();

    const layout = workspaceLayout(root);
    if (
      this.state.status === "ready" &&
      this.state.layout.root === layout.root
    ) {
      return workspaceInfo(this.state.layout);
    }

    const sessionDir = await this.options.filesystem.makeDirectory(
      layout.sessionDir,
      {
        recursive: true,
        mode: 0o700,
      },
    );
    if (sessionDir instanceof Error) {
      return new WorkspaceIoError({ cause: sessionDir });
    }

    const seeded = await seedPluginWorkspace(this.options.filesystem, layout, {
      appVersion: this.options.appVersion,
      alwaysWrite: this.options.isDevelopment === true,
    });
    if (seeded instanceof Error) return seeded;

    if (this.options.cliEntry !== undefined) {
      const installed = await installHaloCli({
        filesystem: this.options.filesystem,
        workspaceRoot: root,
        appVersion: this.options.appVersion,
        cliEntry: this.options.cliEntry,
        nodeExecutable: this.options.cliNodeExecutable,
        electronRunAsNode: this.options.cliElectronRunAsNode,
      });
      if (installed instanceof Error) return installed;
    }
    prependHaloCliPath(root);

    const preference = await writeWorkspacePreference(
      this.options.filesystem,
      this.options.appDataDir,
      root,
    );
    if (preference instanceof Error) return preference;

    this.state = { status: "ready", layout };
    this.directoryPaths = new Set();
    const watched = await this.options.filesystem.watch(layout.root);
    if (watched instanceof Error) {
      console.warn("Workspace watch failed to start:", watched.message);
    }
    return workspaceInfo(layout);
  }

  close() {
    this.unsubscribeFilesystemEvents();
  }

  private async handleWatchEvents(batch: FilesystemWatchBatch) {
    const mapped = mapFilesystemEventsToTreeEvents(
      batch.watchedPath,
      batch.events,
      this.directoryPaths,
    );
    if (this.state.status === "notStarted") return;
    if (batch.watchedPath !== this.state.layout.root) return;
    if (mapped.length === 0) return;
    this.treeEventStream.append(mapped);
  }
}

async function listRelativeWorkspacePaths(
  filesystem: FilesystemService,
  workspaceRoot: string,
) {
  const paths: string[] = [];
  const walked = await walkDirectory(filesystem, workspaceRoot, "", paths);
  if (walked instanceof Error) return walked;
  return paths;
}

async function walkDirectory(
  filesystem: FilesystemService,
  absoluteDir: string,
  relativeDir: string,
  paths: string[],
): Promise<void | WorkspaceIoError> {
  const entries = await filesystem.listDirectory(absoluteDir);
  if (entries instanceof Error) return new WorkspaceIoError({ cause: entries });

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
        filesystem,
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

async function readWorkspacePreference(
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

async function writeWorkspacePreference(
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

function prependHaloCliPath(workspaceRoot: string) {
  const binDir = haloCliBinDir(workspaceRoot);
  const path = process.env.PATH;
  if (path === undefined) {
    process.env.PATH = binDir;
    return;
  }
  if (path.split(delimiter).includes(binDir)) return;
  process.env.PATH = `${binDir}${delimiter}${path}`;
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
