import path from "node:path";
import { Database } from "@tursodatabase/database/compat";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import * as errore from "errore";
import { SerialQueue } from "@get-halo/shared/SerialQueue";
import type { FilesystemService } from "../filesystem/FilesystemService.js";
import { haloSchema, haloSchemaSql } from "./schema.js";

export class DatabaseError extends errore.createTaggedError({
  name: "DatabaseError",
  message: "Application database failed during $operation",
}) {}

type HaloDatabase = BetterSQLite3Database<typeof haloSchema>;

export class DatabaseClient {
  // Orders database access and closes the connection after earlier work.
  private readonly actionQueue = new SerialQueue();

  private readonly connection: Database;
  private readonly db: HaloDatabase;

  private constructor(ctx: { connection: Database; db: HaloDatabase }) {
    const { connection, db } = ctx;
    this.connection = connection;
    this.db = db;
  }

  static async open(input: {
    directory: string;
    filesystem: FilesystemService;
  }) {
    const created = await input.filesystem.makeDirectory(input.directory, {
      recursive: true,
      mode: 0o700,
    });
    if (created instanceof Error)
      return new DatabaseError({
        operation: "create directory",
        cause: created,
      });
    const connection = errore.try({
      try: () => new Database(path.join(input.directory, "state.db")),
      catch: (cause) => new DatabaseError({ operation: "open", cause }),
    });
    if (connection instanceof Error) return connection;
    using cleanup = new errore.DisposableStack();
    cleanup.defer(() => connection.close());
    const configured = errore.try({
      try: () =>
        connection.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;"),
      catch: (cause) => new DatabaseError({ operation: "configure", cause }),
    });
    if (configured instanceof Error) return configured;
    const schemaReady = errore.try({
      try: () => connection.exec(haloSchemaSql),
      catch: (cause) =>
        new DatabaseError({ operation: "create schema", cause }),
    });
    if (schemaReady instanceof Error) return schemaReady;
    // Turso compat implements the synchronous statement API expected by this Drizzle driver.
    const db = drizzle(connection, { schema: haloSchema });
    const client = new DatabaseClient({ connection, db });
    cleanup.move();
    return client;
  }

  query<T>(
    operation: (db: HaloDatabase) => T | Promise<T>,
  ): Promise<T | DatabaseError> {
    return this.actionQueue
      .run(() => operation(this.db))
      .catch((cause) => new DatabaseError({ operation: "query", cause }));
  }

  access<T>(
    operation: (connection: Database) => T | Promise<T>,
  ): Promise<T | DatabaseError> {
    return this.actionQueue
      .run(() => operation(this.connection))
      .catch((cause) => new DatabaseError({ operation: "access", cause }));
  }

  close() {
    return this.actionQueue.run(() =>
      errore.try({
        try: () => this.connection.close(),
        catch: (cause) => new DatabaseError({ operation: "close", cause }),
      }),
    );
  }
}
