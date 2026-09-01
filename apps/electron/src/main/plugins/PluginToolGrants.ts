import nodePath from "node:path";
import { parseVersioned, Type, type Static } from "@halo/plugin-sdk/schema";
import * as errore from "errore";
import {
  type FilesystemService,
  FilesystemPathNotFoundError,
} from "../filesystem/FilesystemService.js";
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

export class PluginToolGrants {
  constructor(
    private readonly options: {
      filesystem: FilesystemService;
      workspace: WorkspaceService;
    },
  ) {}

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

  async grant(input: DeclaredPathsInput & { grantPaths: readonly string[] }) {
    const state = await this.read();
    if (state instanceof Error) return state;

    const declared = uniqueSorted(input.declaredPaths);
    const declaredSet = new Set(declared);
    const previous = state.plugins[input.pluginId];
    const previousGranted = previous === undefined ? [] : previous.granted;
    const active = previousGranted.filter((path) => declaredSet.has(path));
    const activeSet = new Set(active);
    const added = uniqueSorted(input.grantPaths).filter(
      (path) => declaredSet.has(path) && !activeSet.has(path),
    );
    const granted = uniqueSorted([...active, ...added]);
    state.plugins[input.pluginId] = { observed: declared, granted };

    const written = await this.write(state);
    if (written instanceof Error) return written;
    return { declared, granted, added };
  }

  async authorize(input: DeclaredPathsInput & { path: string }) {
    const reconciled = await this.reconcile(input);
    if (reconciled instanceof Error) return reconciled;
    return reconciled.granted.includes(input.path);
  }

  private async read() {
    const filePath = this.filePath();
    if (filePath instanceof Error) return filePath;
    const raw = await this.options.filesystem.readFile(filePath, "utf8");
    if (raw instanceof FilesystemPathNotFoundError) return emptyState();
    if (raw instanceof Error) {
      return new PluginToolGrantsIoError({ operation: "read", cause: raw });
    }

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
    const created = await this.options.filesystem.makeDirectory(
      nodePath.dirname(filePath),
      { recursive: true, mode: 0o700 },
    );
    if (created instanceof Error) {
      return new PluginToolGrantsIoError({
        operation: "create directory for",
        cause: created,
      });
    }
    const written = await this.options.filesystem.writeFile(
      filePath,
      `${JSON.stringify(state, undefined, 2)}\n`,
      {
        mode: 0o600,
      },
    );
    if (written instanceof Error) {
      return new PluginToolGrantsIoError({
        operation: "write",
        cause: written,
      });
    }
  }

  private filePath() {
    const layout = this.options.workspace.getLayout();
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
