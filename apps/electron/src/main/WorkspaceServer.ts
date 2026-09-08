import { HaloServer, type HaloServerOptions } from "@get-halo/server";
import type { FilesystemService } from "@get-halo/server/filesystem";
import * as errore from "errore";
import type { HaloRpcConnection } from "../shared/rpc.js";
import {
  readWorkspacePreference,
  writeWorkspacePreference,
} from "./WorkspacePreference.js";
import { removeHaloRpcFile, writeHaloRpcFile } from "./rpcFile.js";

export class WorkspaceServer {
  private active:
    | { server: HaloServer; connection: HaloRpcConnection }
    | undefined;
  private lifecycle = Promise.resolve();

  constructor(
    private readonly options: {
      filesystem: FilesystemService;
      server: Omit<HaloServerOptions, "workspaceRoot">;
      corsOrigins: readonly string[];
    },
  ) {}

  getWorkspaceRoot() {
    return this.active?.server.getWorkspace().workspaceRoot;
  }

  getConnection() {
    return this.active?.connection;
  }

  async restore() {
    const removed = await removeHaloRpcFile({
      userDataDir: this.options.server.appDataDir,
    });
    if (removed instanceof Error) return removed;
    const preference = await readWorkspacePreference(
      this.options.filesystem,
      this.options.server.appDataDir,
    );
    if (preference instanceof Error) return preference;
    if (preference === undefined) return;
    const selected = await this.select(preference.workspaceRoot);
    if (selected instanceof Error) return selected;
  }

  select(directory: string) {
    return this.serial(() => this.replace(directory));
  }

  close(): Promise<Error | void> {
    return this.serial(async () => {
      const active = this.active;
      this.active = undefined;
      const closed = await active?.server.close();
      const removed = await removeHaloRpcFile({
        userDataDir: this.options.server.appDataDir,
      });
      if (closed instanceof Error) return closed;
      return removed;
    });
  }

  private async replace(directory: string) {
    const workspaceRoot = await this.options.filesystem.realpath(directory);
    if (workspaceRoot instanceof Error) return workspaceRoot;
    if (this.active?.server.getWorkspace().workspaceRoot === workspaceRoot) {
      return this.active.server.getWorkspace();
    }

    await using cleanup = new errore.AsyncDisposableStack();
    const server = await HaloServer.start({
      ...this.options.server,
      workspaceRoot,
      host: "127.0.0.1",
      port: 0,
      corsOrigins: this.options.corsOrigins,
    });
    if (server instanceof Error) return server;
    cleanup.defer(async () => {
      const closed = await server.close();
      if (closed instanceof Error)
        console.warn("Halo server cleanup failed:", closed.message);
    });
    const listening = server.connections;
    const saved = await writeWorkspacePreference(
      this.options.filesystem,
      this.options.server.appDataDir,
      workspaceRoot,
    );
    if (saved instanceof Error) return saved;
    const published = await writeHaloRpcFile({
      userDataDir: this.options.server.appDataDir,
      connection: listening.cli,
    });
    if (published instanceof Error) return published;

    const previous = this.active;
    this.active = {
      server,
      connection: {
        origin: `http://${listening.renderer.host}:${listening.renderer.port}`,
        token: listening.renderer.token,
      },
    };
    cleanup.move();
    const closed = await previous?.server.close();
    if (closed instanceof Error)
      console.warn("Previous Halo server cleanup failed:", closed.message);
    return server.getWorkspace();
  }

  private serial<T>(operation: () => Promise<T>) {
    const result = this.lifecycle.then(operation);
    this.lifecycle = result.then(() => undefined);
    return result;
  }
}
