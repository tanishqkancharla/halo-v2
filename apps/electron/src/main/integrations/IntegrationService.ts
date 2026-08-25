import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import type { GoogleServiceId } from "../../shared/GoogleCatalog.js";
import type {
  ConnectionIntent,
  ConnectionStatus,
  IntegrationConnection,
} from "../../shared/integrations.js";
import type { WorkspaceService } from "../workspace/WorkspaceService.js";

export type {
  ConnectionIntent,
  ConnectionStatus,
  IntegrationConnection,
} from "../../shared/integrations.js";
export { defaultIntegrationProfile } from "../../shared/integrations.js";

export type StoredTokens = {
  accessToken: string;
  refreshToken: string | undefined;
  expiresAtMs: number | undefined;
  tokenType: string;
};

export class IntegrationIoError extends errore.createTaggedError({
  name: "IntegrationIoError",
  message: "Integration I/O failed",
}) {}

export class ConnectionNotFoundError extends errore.createTaggedError({
  name: "ConnectionNotFoundError",
  message: "No integration connection '$id'.",
}) {}

const storedTokensSchema = Type.Object({
  accessToken: Type.String({ minLength: 1 }),
  refreshToken: Type.Optional(Type.String({ minLength: 1 })),
  expiresAtMs: Type.Optional(Type.Number()),
  tokenType: Type.String({ minLength: 1 }),
});

const storedConnectionSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  service: Type.Union([
    Type.Literal("gmail"),
    Type.Literal("calendar"),
    Type.Literal("drive"),
  ]),
  profile: Type.String({ minLength: 1 }),
  scopes: Type.Array(Type.String()),
  status: Type.Union([Type.Literal("pending"), Type.Literal("connected")]),
  intent: Type.Optional(
    Type.Union([
      Type.Literal("connect"),
      Type.Literal("upgrade"),
      Type.Literal("disconnect"),
    ]),
  ),
  tokens: Type.Optional(storedTokensSchema),
});

const storeSchema = Type.Object({
  connections: Type.Array(storedConnectionSchema),
});

type StoredConnection = {
  id: string;
  service: GoogleServiceId;
  profile: string;
  scopes: string[];
  status: ConnectionStatus;
  intent: ConnectionIntent | undefined;
  tokens: StoredTokens | undefined;
};

type IntegrationStore = {
  connections: StoredConnection[];
};

const haloDirectoryName = ".halo";
const integrationsFileName = "integrations.json";

export class IntegrationService {
  private readonly changeListeners = new Set<() => void | Promise<void>>();

  constructor(private readonly workspace: WorkspaceService) {}

  addChangeListener(listener: () => void | Promise<void>) {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  async list() {
    const store = await this.readStore();
    if (store instanceof Error) return store;
    return store.connections.map(publicConnection);
  }

  async get(id: string) {
    const store = await this.readStore();
    if (store instanceof Error) return store;
    const row = store.connections.find((connection) => connection.id === id);
    if (row === undefined) return undefined;
    return publicConnection(row);
  }

  async findByService(input: { service: GoogleServiceId; profile: string }) {
    const store = await this.readStore();
    if (store instanceof Error) return store;
    const row = store.connections.find((connection) =>
      sameServiceProfile(connection, input),
    );
    if (row === undefined) return undefined;
    return publicConnection(row);
  }

  async createPending(input: {
    service: GoogleServiceId;
    profile: string;
    scopes: string[];
    intent: ConnectionIntent;
  }) {
    const store = await this.readStore();
    if (store instanceof Error) return store;

    const existing = store.connections.find((connection) =>
      sameServiceProfile(connection, input),
    );
    const row: StoredConnection = {
      id: existing === undefined ? randomUUID() : existing.id,
      service: input.service,
      profile: input.profile,
      scopes: input.scopes,
      status: "pending",
      intent: input.intent,
      tokens: existing === undefined ? undefined : existing.tokens,
    };
    const connections =
      existing === undefined
        ? [...store.connections, row]
        : store.connections.map((connection) =>
            sameServiceProfile(connection, input) ? row : connection,
          );
    const written = await this.writeStore({ connections });
    if (written instanceof Error) return written;
    await this.notifyChange();
    return publicConnection(row);
  }

  async markConnected(input: {
    id: string;
    scopes: string[];
    tokens: StoredTokens;
  }) {
    const store = await this.readStore();
    if (store instanceof Error) return store;

    const existing = store.connections.find(
      (connection) => connection.id === input.id,
    );
    if (existing === undefined)
      return new ConnectionNotFoundError({ id: input.id });

    const row: StoredConnection = {
      id: existing.id,
      service: existing.service,
      profile: existing.profile,
      scopes: input.scopes,
      status: "connected",
      intent: undefined,
      tokens: input.tokens,
    };
    const written = await this.writeStore({
      connections: store.connections.map((connection) =>
        connection.id === input.id ? row : connection,
      ),
    });
    if (written instanceof Error) return written;
    await this.notifyChange();
    return publicConnection(row);
  }

  async remove(id: string) {
    const store = await this.readStore();
    if (store instanceof Error) return store;
    const connections = store.connections.filter(
      (connection) => connection.id !== id,
    );
    if (connections.length === store.connections.length) return undefined;
    const written = await this.writeStore({ connections });
    if (written instanceof Error) return written;
    await this.notifyChange();
  }

  async getTokens(id: string) {
    const store = await this.readStore();
    if (store instanceof Error) return store;
    const row = store.connections.find((connection) => connection.id === id);
    if (row === undefined) return undefined;
    return row.tokens;
  }

  private async readStore() {
    const path = this.storePath();
    if (path instanceof Error) return path;
    if (!existsSync(path)) return { connections: [] };

    const raw = await readFile(path, "utf8").catch(
      (e) => new IntegrationIoError({ cause: e }),
    );
    if (raw instanceof Error) return raw;

    const parsed = errore.try({
      try: () => {
        // SAFETY: JSON.parse is untyped; storeSchema is the file contract.
        return JSON.parse(raw) as unknown;
      },
      catch: (e) => new IntegrationIoError({ cause: e }),
    });
    if (parsed instanceof Error) return parsed;
    if (!Value.Check(storeSchema, parsed)) return new IntegrationIoError();
    return {
      connections: parsed.connections.map(storedConnection),
    };
  }

  private async writeStore(store: IntegrationStore) {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;

    const haloDirectory = join(layout.root, haloDirectoryName);
    const created = await mkdir(haloDirectory, {
      recursive: true,
      mode: 0o700,
    }).catch((e) => new IntegrationIoError({ cause: e }));
    if (created instanceof Error) return created;

    const written = await writeFile(
      join(haloDirectory, integrationsFileName),
      `${JSON.stringify({ connections: store.connections }, undefined, 2)}\n`,
      { mode: 0o600 },
    ).catch((e) => new IntegrationIoError({ cause: e }));
    if (written instanceof Error) return written;
  }

  private storePath() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;
    return join(layout.root, haloDirectoryName, integrationsFileName);
  }

  private async notifyChange() {
    for (const listener of this.changeListeners) await listener();
  }
}

function sameServiceProfile(
  connection: { service: GoogleServiceId; profile: string },
  input: { service: GoogleServiceId; profile: string },
) {
  return (
    connection.service === input.service && connection.profile === input.profile
  );
}

function publicConnection(row: StoredConnection): IntegrationConnection {
  return {
    id: row.id,
    service: row.service,
    profile: row.profile,
    scopes: row.scopes,
    status: row.status,
    intent: row.intent,
  };
}

function storedConnection(
  row: Static<typeof storedConnectionSchema>,
): StoredConnection {
  return {
    id: row.id,
    service: row.service,
    profile: row.profile,
    scopes: row.scopes,
    status: row.status,
    intent: row.intent,
    tokens:
      row.tokens === undefined
        ? undefined
        : {
            accessToken: row.tokens.accessToken,
            refreshToken: row.tokens.refreshToken,
            expiresAtMs: row.tokens.expiresAtMs,
            tokenType: row.tokens.tokenType,
          },
  };
}
