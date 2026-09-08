import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Logger } from "@repo/logger";
import {
  FilesystemPathNotFoundError,
  type FilesystemService,
} from "../filesystem/FilesystemService.js";
import type { ExtensionSummary } from "@get-halo/shared/contract";
import { readExtensionManifest } from "./ExtensionManifest.js";
import { startExtension, type ExtensionRuntime } from "./ExtensionProcess.js";

type RunningExtension = Exclude<
  Awaited<ReturnType<typeof startExtension>>,
  Error
>;

export class ExtensionHost {
  private readonly processes = new Map<string, RunningExtension>();
  private lifecycle = Promise.resolve();
  private readonly toolTokens = new Map<string, string>();

  constructor(
    private readonly options: {
      workspaceRoot: string;
      toolsOrigin: string;
      filesystem: FilesystemService;
      logger: Logger;
      runtime: ExtensionRuntime;
    },
  ) {}

  async list() {
    const workspaceRoot = this.options.workspaceRoot;
    const extensions: ExtensionSummary[] = [];
    for (const { id, url, isRunning } of this.processes.values()) {
      if (!isRunning()) continue;
      const manifest = await readExtensionManifest({
        filesystem: this.options.filesystem,
        workspaceRoot,
        id,
      });
      if (manifest instanceof Error) return manifest;
      extensions.push({
        id,
        url,
        displayName:
          manifest.halo?.displayName === undefined
            ? id
            : manifest.halo.displayName,
        icon: manifest.halo?.icon,
      });
    }
    return extensions;
  }

  identifyToolConnection(authorization: string | undefined) {
    if (authorization === undefined) return undefined;
    const id = this.toolTokens.get(authorization);
    if (id === undefined || !this.processes.get(id)?.isRunning())
      return undefined;
    return id;
  }

  stop() {
    this.lifecycle = this.lifecycle.then(() => this.stopProcesses());
    return this.lifecycle;
  }

  reload() {
    this.lifecycle = this.lifecycle.then(() => this.discover());
    return this.lifecycle;
  }

  private async discover() {
    const workspaceRoot = this.options.workspaceRoot;
    const directory = join(workspaceRoot, ".halo", "extensions");
    const entries = await this.options.filesystem.listDirectory(directory);
    if (
      entries instanceof Error &&
      !(entries instanceof FilesystemPathNotFoundError)
    ) {
      this.options.logger.warn({
        event: "extension-discovery-failed",
        error: entries,
      });
      return;
    }
    const discovered =
      entries instanceof FilesystemPathNotFoundError
        ? []
        : entries.filter(
            (item) =>
              item.isDirectory() &&
              !item.name.startsWith(".") &&
              this.options.filesystem.exists(
                join(directory, item.name, "package.json"),
              ),
          );
    const ids = new Set(discovered.map((entry) => entry.name));
    for (const [id, extension] of this.processes) {
      if (ids.has(id)) continue;
      const stopped = await extension.stop();
      this.processes.delete(id);
      this.removeToolConnection(id);
      if (stopped instanceof Error)
        this.options.logger.warn({
          event: "extension-stop-failed",
          error: stopped,
        });
    }
    for (const entry of discovered.toSorted((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (this.processes.get(entry.name)?.isRunning()) continue;
      this.removeToolConnection(entry.name);
      const token = randomUUID();
      this.toolTokens.set(`Bearer ${token}`, entry.name);
      const extension = await startExtension({
        id: entry.name,
        workspaceRoot,
        directory: join(directory, entry.name),
        dataDirectory: join(
          workspaceRoot,
          ".halo",
          "extension-data",
          entry.name,
        ),
        runtime: this.options.runtime,
        logger: this.options.logger,
        tools: { origin: this.options.toolsOrigin, token },
      });
      if (extension instanceof Error) {
        this.removeToolConnection(entry.name);
        this.options.logger.warn({
          event: "extension-start-failed",
          error: extension,
        });
        continue;
      }
      this.processes.set(entry.name, extension);
    }
  }

  private async stopProcesses() {
    const processes = [...this.processes.values()];
    this.processes.clear();
    this.toolTokens.clear();
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

  private removeToolConnection(id: string) {
    for (const [token, extensionId] of this.toolTokens) {
      if (extensionId === id) this.toolTokens.delete(token);
    }
  }
}
