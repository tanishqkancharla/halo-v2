import {
  createDrizzleRuntimeSchemaFromTables,
  createDrizzleRuntimeSchemaSqlFromTables,
} from "@executor-js/fumadb/adapters/drizzle";
import type { AbstractQuery } from "@executor-js/fumadb/query";
import type { AnySchema } from "@executor-js/fumadb/schema";
import type { FumaTables } from "@executor-js/sdk/core";
import {
  createExecutorFumaDb,
  type ExecutorFumaDb,
} from "@executor-js/sdk/host-internal";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type {
  DatabaseClient,
  DatabaseError,
} from "../../storage/DatabaseClient.js";

export function createExecutorDatabase<T extends FumaTables>(
  client: DatabaseClient,
  tables: T,
): Promise<Pick<ExecutorFumaDb<T>, "db"> | DatabaseError> {
  return client.access((connection) => {
    const options = {
      tables,
      namespace: "halo_executor",
      version: "1.0.0",
      provider: "sqlite" as const,
    };
    // Fuma's async schema initializer cannot use Turso's synchronous transaction callback.
    connection.transaction(() => {
      for (const sql of createDrizzleRuntimeSchemaSqlFromTables(options))
        connection.exec(sql);
    })();
    // Turso compat implements the synchronous statement API expected by this Drizzle driver.
    const database = drizzle(connection, {
      schema: createDrizzleRuntimeSchemaFromTables(options),
    });
    return {
      db: coordinateExecutor(
        client,
        createExecutorFumaDb(database, options).db,
      ),
    };
  });
}

function coordinateExecutor<S extends AnySchema>(
  client: DatabaseClient,
  db: AbstractQuery<S>,
): AbstractQuery<S> {
  const access = async <T>(run: () => Promise<T>) => {
    const result = await client.access(run);
    // Fuma's adapter contract reports storage failures as rejected promises.
    if (result instanceof Error) throw result;
    return result;
  };
  return {
    internal: db.internal,
    // Fuma supplies a non-enumerable withContext; decorators must preserve its policy context.
    withContext: (context) =>
      coordinateExecutor(client, db.withContext!(context)),
    count: (table, options) => access(() => db.count(table, options)),
    findFirst: (table, options) => access(() => db.findFirst(table, options)),
    findMany: (table, options) => access(() => db.findMany(table, options)),
    create: (table, values) => access(() => db.create(table, values)),
    createMany: (table, values) => access(() => db.createMany(table, values)),
    updateMany: (table, options) => access(() => db.updateMany(table, options)),
    deleteMany: (table, options) => access(() => db.deleteMany(table, options)),
    upsert: (table, options) => access(() => db.upsert(table, options)),
    // The callback receives Fuma's transaction query, so its operations do not acquire the queue again.
    transaction: (run) => access(() => db.transaction(run)),
  };
}
