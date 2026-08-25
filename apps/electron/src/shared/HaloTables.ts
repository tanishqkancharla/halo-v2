import {
  TandemClient,
  collection,
  defineSchema,
  type Transaction,
} from "@tandem/core";
import type { CollectionName } from "@tandem/types";
import type { IntegrationConnection } from "./integrations.js";
import type { PluginLoadError } from "./plugin.js";
import type {
  AppInfo,
  SessionSummary,
  WorkspaceInfo,
  WorkspaceTreeEvent,
} from "./rpc.js";

export type WorkspaceState =
  | { status: "needs-workspace"; message?: string }
  | { status: "ready"; workspace: WorkspaceInfo };

type WorkspaceRow = {
  id: "current";
  status: "needs-workspace" | "ready";
  message?: string;
  name?: string;
  workspaceRoot?: string;
};

type SessionRow = {
  id: string;
  agent: "pi";
  cwd: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
};

type WorkspacePathRow = {
  id: string;
};

type AppInfoRow = AppInfo & {
  id: "current";
};

type PluginRow = {
  id: string;
  hasServer: boolean;
};

type PluginViewRow = {
  id: string;
  source: string;
};

type PluginErrorRow = PluginLoadError;

export const haloTables = defineSchema({
  workspaces: collection<WorkspaceRow>({
    fields: ["id", "status", "message", "name", "workspaceRoot"],
  }),
  sessions: collection<SessionRow>({
    fields: ["id", "agent", "cwd", "title", "createdAt", "updatedAt"],
  }),
  workspacePaths: collection<WorkspacePathRow>({
    fields: ["id"],
  }),
  appInfos: collection<AppInfoRow>({
    fields: ["id", "version", "update"],
  }),
  integrations: collection<IntegrationConnection>({
    fields: ["id", "service", "profile", "scopes", "status", "intent"],
  }),
  plugins: collection<PluginRow>({
    fields: ["id", "hasServer"],
  }),
  pluginViews: collection<PluginViewRow>({
    fields: ["id", "source"],
  }),
  pluginErrors: collection<PluginErrorRow>({
    fields: ["id", "message"],
  }),
});

export type HaloSchema = {
  workspaces: WorkspaceRow;
  sessions: SessionRow;
  workspacePaths: WorkspacePathRow;
  appInfos: AppInfoRow;
  integrations: IntegrationConnection;
  plugins: PluginRow;
  pluginErrors: PluginErrorRow;
  pluginViews: PluginViewRow;
};

export const currentId = "current";

export const silentTandemLogger = {
  debug() {},
  info() {},
  warn() {},
  log() {},
  error() {},
  scope() {
    return silentTandemLogger;
  },
};

export function commitWrites(
  client: TandemClient<HaloSchema>,
  build: (tx: Transaction<HaloSchema>) => void,
) {
  const tx = client.transact();
  build(tx);
  return client.commit(tx);
}

export function replaceCollection<
  Collection extends CollectionName<HaloSchema>,
>(
  tx: Transaction<HaloSchema>,
  collectionName: Collection,
  records: HaloSchema[Collection][],
) {
  for (const existing of tx.list(collectionName)) {
    tx.remove(collectionName, existing.id);
  }
  for (const record of records) {
    tx.set(collectionName, record);
  }
}

export function workspaceToRow(state: WorkspaceState): WorkspaceRow {
  if (state.status === "ready") {
    return {
      id: currentId,
      status: "ready",
      name: state.workspace.name,
      workspaceRoot: state.workspace.workspaceRoot,
    };
  }
  if (state.message === undefined) {
    return { id: currentId, status: "needs-workspace" };
  }
  return {
    id: currentId,
    status: "needs-workspace",
    message: state.message,
  };
}

export function workspaceFromRow(row: WorkspaceRow): WorkspaceState {
  if (row.status === "ready") {
    if (row.name === undefined || row.workspaceRoot === undefined) {
      return { status: "needs-workspace" };
    }
    return {
      status: "ready",
      workspace: { name: row.name, workspaceRoot: row.workspaceRoot },
    };
  }
  if (row.message === undefined) return { status: "needs-workspace" };
  return { status: "needs-workspace", message: row.message };
}

export function sessionToRow(session: SessionSummary): SessionRow {
  if (session.title === undefined) {
    return {
      id: session.sessionId,
      agent: session.agent,
      cwd: session.cwd,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
  return {
    id: session.sessionId,
    agent: session.agent,
    cwd: session.cwd,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function sessionFromRow(row: SessionRow): SessionSummary {
  if (row.title === undefined) {
    return {
      sessionId: row.id,
      agent: row.agent,
      cwd: row.cwd,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
  return {
    sessionId: row.id,
    agent: row.agent,
    cwd: row.cwd,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function pathRows(paths: string[]): WorkspacePathRow[] {
  return paths.map((path) => ({ id: path }));
}

export function pathsFromRows(rows: WorkspacePathRow[]): string[] {
  return rows.map((row) => row.id);
}

export function appInfoToRow(info: AppInfo): AppInfoRow {
  return { id: currentId, version: info.version, update: info.update };
}

export function appInfoFromRow(row: AppInfoRow): AppInfo {
  return { version: row.version, update: row.update };
}

export function applyPathEvents(paths: string[], events: WorkspaceTreeEvent[]) {
  return events.reduce((next, event) => {
    if (event.type === "create") {
      if (next.includes(event.path)) return next;
      return [...next, event.path];
    }
    return next.filter((path) => {
      if (path === event.path) return false;
      return !path.startsWith(`${event.path}/`);
    });
  }, paths);
}
