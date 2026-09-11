import { EventEmitter, on } from "node:events";
import { join } from "node:path";
import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import { SerialQueue } from "@get-halo/shared/SerialQueue";
import type { ExtensionPermissionRequest } from "@get-halo/shared/contract";
import {
  FilesystemPathNotFoundError,
  type FilesystemService,
} from "../filesystem/FilesystemService.js";
import type { ToolRuntime } from "../agent/runtime/ToolRuntime.js";
import { readExtensionManifest } from "./ExtensionManifest.js";

export class ExtensionToolsError extends errore.createTaggedError({
  name: "ExtensionToolsError",
  message: "Extension tools: $detail",
}) {}

const grantsSchema = Type.Record(
  Type.String(),
  Type.Object({
    granted: Type.Array(Type.String()),
    pending: Type.Array(Type.String()),
  }),
);
type Grants = Static<typeof grantsSchema>;

export class ExtensionTools {
  // Notifies request subscribers when persisted grants change.
  private readonly changes = new EventEmitter();
  // Orders permission reads and writes to prevent lost updates.
  private readonly actionQueue = new SerialQueue();

  private readonly filesystem: FilesystemService;
  private readonly workspaceRoot: string;
  private readonly toolRuntime: ToolRuntime;

  constructor(ctx: {
    filesystem: FilesystemService;
    workspaceRoot: string;
    toolRuntime: ToolRuntime;
  }) {
    const { filesystem, workspaceRoot, toolRuntime } = ctx;
    this.filesystem = filesystem;
    this.workspaceRoot = workspaceRoot;
    this.toolRuntime = toolRuntime;
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
        for (const [id, grant] of Object.entries(state)) {
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
    change?: (grant: Grants[string], available: string[]) => void,
  ) {
    const manifest = await this.readManifest(id);
    if (manifest instanceof Error) return manifest;
    const state = await this.readGrants();
    if (state instanceof Error) return state;
    const before = JSON.stringify(state);
    const requested =
      manifest.halo?.capabilities === undefined
        ? []
        : manifest.halo.capabilities;
    const previous = Object.hasOwn(state, id) ? state[id] : undefined;
    const grant =
      previous === undefined ? { granted: [], pending: [] } : previous;
    grant.granted = grant.granted.filter((path) => requested.includes(path));
    grant.pending = grant.pending.filter((path) => requested.includes(path));
    const catalog =
      requested.length === 0 ? [] : await this.toolRuntime.listToolPaths();
    if (catalog instanceof Error) return catalog;
    const existing = requested.filter((path) => catalog.includes(path));
    change?.(grant, existing);
    state[id] = grant;
    if (before !== JSON.stringify(state)) {
      const written = await this.filesystem.writeFile(
        join(this.workspaceRoot, ".halo", "extensionGrants.json"),
        `${JSON.stringify(state, undefined, 2)}\n`,
        { mode: 0o600 },
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

  private async readGrants() {
    const source = await this.filesystem.readFile(
      join(this.workspaceRoot, ".halo", "extensionGrants.json"),
      "utf8",
    );
    if (source instanceof FilesystemPathNotFoundError)
      return {} satisfies Grants;
    if (source instanceof Error) return source;
    return parse(grantsSchema, source);
  }
}

function parse<S extends TSchema>(
  schema: S,
  source: string,
): Static<S> | ExtensionToolsError {
  const value: unknown = errore.try({
    try: () => JSON.parse(source),
    catch: (cause) =>
      new ExtensionToolsError({ detail: "invalid JSON", cause }),
  });
  if (value instanceof Error) return value;
  if (!Value.Check(schema, value))
    return new ExtensionToolsError({ detail: "invalid manifest or grants" });
  return value;
}
