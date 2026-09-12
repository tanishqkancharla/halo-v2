import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import * as errore from "errore";
import type { DatabaseService } from "./DatabaseService.js";

class WorkspaceServiceError extends errore.createTaggedError({
  name: "WorkspaceServiceError",
  message: "Workspace service failed: $detail",
}) {}

type SqliteWorkspaceRow = {
  id: string;
  created_at: string;
};

type PostgresWorkspaceRow = {
  id: string;
  created_at: Date;
};

type Workspace = {
  id: string;
  createdAt: Date;
};

export class WorkspaceService {
  private readonly db: DatabaseService;

  private constructor(ctx: { db: DatabaseService }) {
    this.db = ctx.db;
  }

  static async start(ctx: { db: DatabaseService }) {
    const service = new WorkspaceService(ctx);
    const migrated = await service.migrate();
    if (migrated instanceof Error) return migrated;

    return service;
  }

  async ensure(userId: string) {
    const client = this.db.client;
    const workspaceId = crypto.randomUUID();
    const createdAt = new Date();

    if (client instanceof DatabaseSync) {
      return errore.try({
        try: () => {
          client
            .prepare(
              `INSERT INTO workspace (id, user_id, created_at)
               VALUES (?, ?, ?)
               ON CONFLICT (user_id) DO NOTHING`,
            )
            .run(workspaceId, userId, createdAt.toISOString());

          // SAFETY: The insert or its unique conflict guarantees this row exists.
          const row = client
            .prepare(
              `SELECT id, created_at
               FROM workspace
               WHERE user_id = ?`,
            )
            .get(userId) as SqliteWorkspaceRow;

          return {
            id: row.id,
            createdAt: new Date(row.created_at),
          } satisfies Workspace;
        },
        catch: (cause) =>
          new WorkspaceServiceError({ detail: "ensure workspace", cause }),
      });
    }

    const inserted = await client
      .query(
        `INSERT INTO workspace (id, user_id, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO NOTHING`,
        [workspaceId, userId, createdAt],
      )
      .catch(
        (cause) =>
          new WorkspaceServiceError({ detail: "ensure workspace", cause }),
      );
    if (inserted instanceof Error) return inserted;

    const selected = await client
      .query<PostgresWorkspaceRow>(
        `SELECT id, created_at
         FROM workspace
         WHERE user_id = $1`,
        [userId],
      )
      .catch(
        (cause) =>
          new WorkspaceServiceError({ detail: "load workspace", cause }),
      );
    if (selected instanceof Error) return selected;

    // SAFETY: The insert or its unique conflict guarantees this row exists.
    const row = selected.rows[0] as PostgresWorkspaceRow;
    return { id: row.id, createdAt: row.created_at } satisfies Workspace;
  }

  private migrate() {
    const client = this.db.client;

    if (client instanceof DatabaseSync) {
      return Promise.resolve(
        errore.try({
          try: () =>
            client.exec(`CREATE TABLE IF NOT EXISTS workspace (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
              created_at TEXT NOT NULL
            )`),
          catch: (cause) =>
            new WorkspaceServiceError({
              detail: "migrate SQLite schema",
              cause,
            }),
        }),
      );
    }

    return client
      .query(`CREATE TABLE IF NOT EXISTS workspace (
        id UUID PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL
      )`)
      .then(() => undefined)
      .catch(
        (cause) =>
          new WorkspaceServiceError({
            detail: "migrate PostgreSQL schema",
            cause,
          }),
      );
  }
}
