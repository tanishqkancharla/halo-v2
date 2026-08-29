import fs from "node:fs/promises";
import nodePath from "node:path";
import { parseVersioned, Type, type Static } from "@halo/plugin-sdk/schema";
import * as errore from "errore";
import type { WorkspaceService } from "../workspace/WorkspaceService.js";

export class PluginToolGrantsIoError extends errore.createTaggedError({
  name: "PluginToolGrantsIoError",
  message: "Failed to $operation plugin tool grants",
}) {}

export class PluginToolGrantsParseError extends errore.createTaggedError({
  name: "PluginToolGrantsParseError",
  message: "Failed to parse plugin tool grants",
}) {}

const pluginGrantSchema = Type.Object({
  observed: Type.Array(Type.String(), { uniqueItems: true }),
  granted: Type.Array(Type.String(), { uniqueItems: true }),
});

const pluginToolGrantStateSchema = Type.Object({
  version: Type.Literal(1),
  plugins: Type.Record(Type.String(), pluginGrantSchema),
});

type PluginToolGrantState = Static<typeof pluginToolGrantStateSchema>;

type DeclaredPathsInput = {
  pluginId: string;
  declaredPaths: readonly string[];
};

// oxlint-disable-next-line anti-slop/no-unused-exports -- Phase 3 will consume the grant store.
export class PluginToolGrants {
  constructor(private readonly workspace: WorkspaceService) {}

  async reconcile(input: DeclaredPathsInput) {
    const state = await this.read();
    if (state instanceof Error) return state;

    const declared = uniqueSorted(input.declaredPaths);
    const previous = state.plugins[input.pluginId];
    const previousGranted = previous === undefined ? [] : previous.granted;
    const declaredSet = new Set(declared);
    const granted = previousGranted.filter((path) => declaredSet.has(path));
    const revoked = previousGranted.filter((path) => !declaredSet.has(path));
    state.plugins[input.pluginId] = { observed: declared, granted };

    const written = await this.write(state);
    if (written instanceof Error) return written;
    return { declared, granted, revoked };
  }

  async grant(input: DeclaredPathsInput) {
    const state = await this.read();
    if (state instanceof Error) return state;

    const declared = uniqueSorted(input.declaredPaths);
    const declaredSet = new Set(declared);
    const previous = state.plugins[input.pluginId];
    const previousGranted = previous === undefined ? [] : previous.granted;
    const active = previousGranted.filter((path) => declaredSet.has(path));
    const activeSet = new Set(active);
    const added = declared.filter((path) => !activeSet.has(path));
    const granted = uniqueSorted([...active, ...added]);
    state.plugins[input.pluginId] = { observed: declared, granted };

    const written = await this.write(state);
    if (written instanceof Error) return written;
    return { declared, granted, added };
  }

  private async read() {
    const filePath = this.filePath();
    if (filePath instanceof Error) return filePath;
    const raw = await fs
      .readFile(filePath, "utf8")
      .catch((cause: unknown) =>
        isNodeErrorCode(cause, "ENOENT")
          ? undefined
          : new PluginToolGrantsIoError({ operation: "read", cause }),
      );
    if (raw instanceof Error) return raw;
    if (raw === undefined) return emptyState();

    const json = errore.try({
      // SAFETY: JSON.parse is untyped; pluginToolGrantStateSchema validates the result.
      try: () => JSON.parse(raw) as unknown,
      catch: (cause) => new PluginToolGrantsParseError({ cause }),
    });
    if (json instanceof Error) return json;
    const parsed = parseVersioned({
      name: "pluginGrants.json",
      schema: pluginToolGrantStateSchema,
      value: json,
    });
    if (parsed instanceof Error) {
      return new PluginToolGrantsParseError({ cause: parsed });
    }
    return parsed;
  }

  private async write(state: PluginToolGrantState) {
    const filePath = this.filePath();
    if (filePath instanceof Error) return filePath;
    const created = await fs
      .mkdir(nodePath.dirname(filePath), { recursive: true, mode: 0o700 })
      .catch(
        (cause) =>
          new PluginToolGrantsIoError({
            operation: "create directory for",
            cause,
          }),
      );
    if (created instanceof Error) return created;
    const written = await fs
      .writeFile(filePath, `${JSON.stringify(state, undefined, 2)}\n`, {
        mode: 0o600,
      })
      .catch(
        (cause) => new PluginToolGrantsIoError({ operation: "write", cause }),
      );
    if (written instanceof Error) return written;
  }

  private filePath() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;
    return nodePath.join(layout.root, ".halo", "pluginGrants.json");
  }
}

function emptyState(): PluginToolGrantState {
  return { version: 1, plugins: {} };
}

function uniqueSorted(paths: readonly string[]) {
  return [...new Set(paths)].toSorted();
}

function isNodeErrorCode(cause: unknown, code: string) {
  return cause instanceof Error && "code" in cause && cause.code === code;
}
