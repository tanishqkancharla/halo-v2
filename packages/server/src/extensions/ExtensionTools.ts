import { EventEmitter, on } from "node:events";
import { join } from "node:path";
import * as errore from "errore";
import { SerialQueue } from "@get-halo/shared/SerialQueue";
import type { ExtensionPermissionRequest } from "@get-halo/shared/contract";
import type { FilesystemService } from "../filesystem/FilesystemService.js";
import type { DatabaseClient } from "../storage/DatabaseClient.js";
import type { ToolRuntime } from "../agent/runtime/ToolRuntime.js";
import { readExtensionManifest } from "./ExtensionManifest.js";

export class ExtensionToolsError extends errore.createTaggedError({
  name: "ExtensionToolsError",
  message: "Extension tools: $detail",
}) {}

type Grant = { granted: string[]; pending: string[] };
type PermissionRow = {
  extension_id: string;
  path: string;
  status: keyof Grant;
};
type ExtensionToolsContext = {
  database: DatabaseClient;
  filesystem: FilesystemService;
  workspaceRoot: string;
  toolRuntime: ToolRuntime;
};

export class ExtensionTools {
  // Notifies request subscribers when persisted grants change.
  private readonly changes = new EventEmitter();
  // Orders permission reads and writes to prevent lost updates.
  private readonly actionQueue = new SerialQueue();

  private readonly database: DatabaseClient;
  private readonly filesystem: FilesystemService;
  private readonly workspaceRoot: string;
  private readonly toolRuntime: ToolRuntime;

  private constructor(ctx: ExtensionToolsContext) {
    const { database, filesystem, workspaceRoot, toolRuntime } = ctx;
    this.database = database;
    this.filesystem = filesystem;
    this.workspaceRoot = workspaceRoot;
    this.toolRuntime = toolRuntime;
  }

  static async open(ctx: ExtensionToolsContext) {
    const initialized = await ctx.database.access((connection) =>
      connection.exec(`
        CREATE TABLE IF NOT EXISTS halo_extension_permissions (
          extension_id TEXT NOT NULL,
          path TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('granted', 'pending')),
          PRIMARY KEY (extension_id, path)
        )
      `),
    );
    if (initialized instanceof Error) return initialized;
    return new ExtensionTools(ctx);
  }

  add(id: string, paths: string[]) {
    return this.actionQueue.run(async () => {
      const manifest = await this.readManifest(id);
      if (manifest instanceof Error) return manifest;
      const declared =
        manifest.halo?.capabilities === undefined
          ? []
          : manifest.halo.capabilities;
      manifest.halo = {
        ...manifest.halo,
        capabilities: [...new Set([...declared, ...paths])].toSorted(),
      };
      const written = await this.filesystem.writeFile(
        join(this.workspaceRoot, ".halo", "extensions", id, "package.json"),
        `${JSON.stringify(manifest, undefined, 2)}\n`,
      );
      if (written instanceof Error) return written;
      return this.updateGrantsUnqueued(id, (grant, available) => {
        const added = paths.filter(
          (path) => available.includes(path) && !grant.granted.includes(path),
        );
        grant.pending = [...new Set([...grant.pending, ...added])].toSorted();
      });
    });
  }

  check(id: string) {
    return this.actionQueue.run(() => this.updateGrantsUnqueued(id));
  }

  decide(id: string, paths: string[], action: "allow" | "deny" | "revoke") {
    return this.actionQueue.run(() => {
      return this.updateGrantsUnqueued(id, (grant, available) => {
        if (action === "allow") {
          const allowed = paths.filter(
            (path) => grant.pending.includes(path) && available.includes(path),
          );
          grant.granted = [
            ...new Set([...grant.granted, ...allowed]),
          ].toSorted();
        }
        if (action === "revoke")
          grant.granted = grant.granted.filter((path) => !paths.includes(path));
        grant.pending = grant.pending.filter((path) => !paths.includes(path));
      });
    });
  }

  async invoke(
    id: string,
    invocation: Parameters<ToolRuntime["invokePath"]>[0],
  ) {
    const { path } = invocation;
    const checked = await this.check(id);
    if (checked instanceof Error) return checked;
    if (!checked.granted.includes(path)) {
      return {
        ok: false as const,
        error: {
          code: "tool_not_granted",
          message: `Extension '${id}' is not granted tool '${path}'.`,
        },
      };
    }
    return this.toolRuntime.invokePath(invocation);
  }

  async *requests(signal: AbortSignal | undefined) {
    const events = on(this.changes, "change", { signal });
    await using cleanup = new errore.AsyncDisposableStack();
    cleanup.defer(async () => {
      await events.return?.();
    });
    while (true) {
      const snapshot = await this.actionQueue.run(async () => {
        const state = await this.readGrants();
        if (state instanceof Error) return state;
        const requests: ExtensionPermissionRequest[] = [];
        for (const [id, grant] of state) {
          if (grant.pending.length === 0) continue;
          const manifest = await this.readManifest(id);
          if (manifest instanceof Error) {
            console.warn(manifest);
            continue;
          }
          requests.push({
            id,
            displayName:
              manifest.halo?.displayName === undefined
                ? id
                : manifest.halo.displayName,
            paths: grant.pending,
          });
        }
        return requests;
      });
      if (snapshot instanceof Error) throw snapshot;
      yield snapshot;
      const next = await events
        .next()
        .catch(
          (cause) =>
            new ExtensionToolsError({ detail: "watch requests", cause }),
        );
      if (next instanceof Error) {
        if (signal?.aborted) return;
        throw next;
      }
      if (next.done) return;
    }
  }

  private async updateGrantsUnqueued(
    id: string,
    change?: (grant: Grant, available: string[]) => void,
  ) {
    const manifest = await this.readManifest(id);
    if (manifest instanceof Error) return manifest;
    const state = await this.readGrants(id);
    if (state instanceof Error) return state;
    const requested =
      manifest.halo?.capabilities === undefined
        ? []
        : manifest.halo.capabilities;
    const previous = state.get(id);
    const grant =
      previous === undefined ? { granted: [], pending: [] } : previous;
    const before = JSON.stringify(grant);
    grant.granted = grant.granted.filter((path) => requested.includes(path));
    grant.pending = grant.pending.filter((path) => requested.includes(path));
    const catalog =
      requested.length === 0 ? [] : await this.toolRuntime.listToolPaths();
    if (catalog instanceof Error) return catalog;
    const existing = requested.filter((path) => catalog.includes(path));
    change?.(grant, existing);
    if (before !== JSON.stringify(grant)) {
      const written = await this.database.access((connection) =>
        connection.transaction(() => {
          connection
            .prepare(
              "DELETE FROM halo_extension_permissions WHERE extension_id = ?",
            )
            .run(id);
          const insert = connection.prepare(
            "INSERT INTO halo_extension_permissions (extension_id, path, status) VALUES (?, ?, ?)",
          );
          for (const path of grant.granted) insert.run(id, path, "granted");
          for (const path of grant.pending) insert.run(id, path, "pending");
        })(),
      );
      if (written instanceof Error) return written;
      this.changes.emit("change");
    }
    return {
      displayName:
        manifest.halo?.displayName === undefined
          ? id
          : manifest.halo.displayName,
      requested,
      existing,
      granted: grant.granted,
      pending: grant.pending,
      missing: requested.filter((path) => !catalog.includes(path)),
    };
  }

  private async readManifest(id: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id))
      return new ExtensionToolsError({ detail: "invalid extension id" });

    return readExtensionManifest({
      filesystem: this.filesystem,
      workspaceRoot: this.workspaceRoot,
      id,
    });
  }

  private readGrants(id?: string) {
    return this.database.access((connection) => {
      // SAFETY: Both queries match the columns and status constraint initialized in open().
      const rows = (
        id === undefined
          ? connection
              .prepare(
                "SELECT extension_id, path, status FROM halo_extension_permissions ORDER BY extension_id, path",
              )
              .all()
          : connection
              .prepare(
                "SELECT extension_id, path, status FROM halo_extension_permissions WHERE extension_id = ? ORDER BY path",
              )
              .all(id)
      ) as PermissionRow[];
      const state = new Map<string, Grant>();
      for (const row of rows) {
        let grant = state.get(row.extension_id);
        if (grant === undefined) {
          grant = { granted: [], pending: [] };
          state.set(row.extension_id, grant);
        }
        grant[row.status].push(row.path);
      }
      return state;
    });
  }
}
