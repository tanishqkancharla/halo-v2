import path from "node:path";
import { Database } from "@tursodatabase/database/compat";
import * as errore from "errore";
import type { FilesystemService } from "../filesystem/FilesystemService.js";

export class DatabaseError extends errore.createTaggedError({
  name: "DatabaseError",
  message: "Application database failed during $operation",
}) {}

export class DatabaseClient {
  private pending: Promise<void> = Promise.resolve();

  private constructor(private readonly connection: Database) {}

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
    const client = new DatabaseClient(connection);
    cleanup.move();
    return client;
  }

  access<T>(
    operation: (connection: Database) => T | Promise<T>,
  ): Promise<T | DatabaseError> {
    const result = this.pending
      .then(() => operation(this.connection))
      .catch((cause) => new DatabaseError({ operation: "access", cause }));
    this.pending = result.then(() => undefined);
    return result;
  }

  async close() {
    await this.pending;
    return errore.try({
      try: () => this.connection.close(),
      catch: (cause) => new DatabaseError({ operation: "close", cause }),
    });
  }
}
