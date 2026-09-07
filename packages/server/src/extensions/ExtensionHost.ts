import { join } from "node:path";
import type { Logger } from "@repo/logger";
import {
  FilesystemPathNotFoundError,
  type FilesystemService,
} from "../filesystem/FilesystemService.js";
import { startExtension, type ExtensionRuntime } from "./ExtensionProcess.js";

type RunningExtension = Exclude<
  Awaited<ReturnType<typeof startExtension>>,
  Error
>;

export class ExtensionHost {
  private readonly processes = new Map<string, RunningExtension>();
  private workspaceRoot: string | undefined;
  private lifecycle = Promise.resolve();

  constructor(
    private readonly options: {
      filesystem: FilesystemService;
      logger: Logger;
      runtime: ExtensionRuntime;
    },
  ) {}

  list() {
    return [...this.processes.values()]
      .filter((extension) => extension.isRunning())
      .map(({ id, url }) => ({ id, url }));
  }

  start(workspaceRoot: string) {
    this.lifecycle = this.lifecycle.then(() =>
      this.startWorkspace(workspaceRoot),
    );
    return this.lifecycle;
  }

  stop() {
    this.lifecycle = this.lifecycle.then(() => this.stopWorkspace());
    return this.lifecycle;
  }

  reload() {
    this.lifecycle = this.lifecycle.then(() => {
      if (this.workspaceRoot === undefined) return;
      return this.discover(this.workspaceRoot);
    });
    return this.lifecycle;
  }

  private async startWorkspace(workspaceRoot: string) {
    if (this.workspaceRoot === workspaceRoot) return;
    await this.stopWorkspace();
    this.workspaceRoot = workspaceRoot;
    await this.discover(workspaceRoot);
  }

  private async discover(workspaceRoot: string) {
    const directory = join(workspaceRoot, ".halo", "extensions");
    const entries = await this.options.filesystem.listDirectory(directory);
    if (entries instanceof FilesystemPathNotFoundError) return;
    if (entries instanceof Error) {
      this.options.logger.warn({
        event: "extension-discovery-failed",
        error: entries,
      });
      return;
    }
    for (const entry of entries
      .filter((item) => item.isDirectory() && !item.name.startsWith("."))
      .toSorted((a, b) => a.name.localeCompare(b.name))) {
      if (this.processes.get(entry.name)?.isRunning()) continue;
      const extension = await startExtension({
        id: entry.name,
        directory: join(directory, entry.name),
        dataDirectory: join(
          workspaceRoot,
          ".halo",
          "extension-data",
          entry.name,
        ),
        runtime: this.options.runtime,
        logger: this.options.logger,
      });
      if (extension instanceof Error) {
        this.options.logger.warn({
          event: "extension-start-failed",
          error: extension,
        });
        continue;
      }
      this.processes.set(entry.name, extension);
    }
  }

  private async stopWorkspace() {
    const processes = [...this.processes.values()];
    this.processes.clear();
    this.workspaceRoot = undefined;
    for (const result of await Promise.all(
      processes.map((extension) => extension.stop()),
    )) {
      if (result instanceof Error)
        this.options.logger.warn({
          event: "extension-stop-failed",
          error: result,
        });
    }
  }
}
