import fs from "node:fs/promises";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as errore from "errore";
import { Pool } from "pg";

class DatabaseServiceError extends errore.createTaggedError({
  name: "DatabaseServiceError",
  message: "Database failed: $detail",
}) {}

export type DatabaseConfig =
  | { type: "sqlite"; path: string }
  | { type: "postgres"; connectionString: string };

export type DatabaseClient = DatabaseSync | Pool;

export class DatabaseService {
  private readonly database: DatabaseClient;

  private constructor(ctx: { client: DatabaseClient }) {
    this.database = ctx.client;
  }

  static async start(config: DatabaseConfig) {
    if (config.type === "postgres") {
      const client = errore.try({
        try: () =>
          new Pool({ connectionString: config.connectionString, max: 5 }),
        catch: (cause) =>
          new DatabaseServiceError({ detail: "open PostgreSQL pool", cause }),
      });
      if (client instanceof Error) return client;

      return new DatabaseService({ client });
    }

    const created = await fs
      .mkdir(dirname(config.path), { recursive: true, mode: 0o700 })
      .catch(
        (cause) =>
          new DatabaseServiceError({
            detail: "create data directory",
            cause,
          }),
      );
    if (created instanceof Error) return created;

    const client = errore.try({
      try: () => new DatabaseSync(config.path),
      catch: (cause) =>
        new DatabaseServiceError({ detail: "open SQLite database", cause }),
    });
    if (client instanceof Error) return client;

    return new DatabaseService({ client });
  }

  get client() {
    return this.database;
  }

  async close() {
    const client = this.database;

    if (client instanceof DatabaseSync) {
      return errore.try({
        try: () => client.close(),
        catch: (cause) =>
          new DatabaseServiceError({
            detail: "close SQLite database",
            cause,
          }),
      });
    }

    return await client.end().catch(
      (cause) =>
        new DatabaseServiceError({
          detail: "close PostgreSQL pool",
          cause,
        }),
    );
  }
}
