import fs from "node:fs/promises";
import path from "node:path";
import {
  createDrizzleRuntimeSchemaFromTables,
  ensureDrizzleRuntimeSchemaFromTables,
} from "@executor-js/fumadb/adapters/drizzle";
import { createExecutorFumaDb } from "@executor-js/sdk/host-internal";
import type { FumaTables } from "@executor-js/sdk/core";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as errore from "errore";

class ExecutorDatabaseError extends errore.createTaggedError({
  name: "ExecutorDatabaseError",
  message: "Executor database failed during $operation",
}) {}

const namespace = "halo_executor";
const version = "1.0.0";

export async function openExecutorDatabase(input: {
  workspaceRoot: string;
  tables: FumaTables;
}) {
  const directory = path.join(input.workspaceRoot, ".halo", "executor");
  const created = await fs
    .mkdir(directory, { recursive: true, mode: 0o700 })
    .catch(
      (cause) =>
        new ExecutorDatabaseError({ operation: "create directory", cause }),
    );
  if (created instanceof Error) return created;

  const client = errore.try({
    try: () =>
      createClient({
        url: `file:${path.join(directory, "metadata.sqlite")}`,
      }),
    catch: (cause) => new ExecutorDatabaseError({ operation: "open", cause }),
  });
  if (client instanceof Error) return client;

  const foreignKeys = await client
    .execute("PRAGMA foreign_keys = ON")
    .catch(
      (cause) => new ExecutorDatabaseError({ operation: "configure", cause }),
    );
  if (foreignKeys instanceof Error) {
    client.close();
    return foreignKeys;
  }
  const journal = await client
    .execute("PRAGMA journal_mode = WAL")
    .catch(
      (cause) => new ExecutorDatabaseError({ operation: "configure", cause }),
    );
  if (journal instanceof Error) {
    client.close();
    return journal;
  }

  const options = {
    tables: input.tables,
    namespace,
    version,
    provider: "sqlite" as const,
  };
  const database = errore.try({
    try: () => {
      const schema = createDrizzleRuntimeSchemaFromTables(options);
      return drizzle({ client, schema });
    },
    catch: (cause) =>
      new ExecutorDatabaseError({ operation: "create schema", cause }),
  });
  if (database instanceof Error) {
    client.close();
    return database;
  }
  const ensured = await ensureDrizzleRuntimeSchemaFromTables(database, options)
    .then(() => undefined)
    .catch(
      (cause) =>
        new ExecutorDatabaseError({ operation: "initialize schema", cause }),
    );
  if (ensured instanceof Error) {
    client.close();
    return ensured;
  }

  const executorDatabase = errore.try({
    try: () => createExecutorFumaDb(database, options),
    catch: (cause) =>
      new ExecutorDatabaseError({ operation: "create adapter", cause }),
  });
  if (executorDatabase instanceof Error) {
    client.close();
    return executorDatabase;
  }
  return {
    db: executorDatabase.db,
    close: () => client.close(),
  };
}
