import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type {
  AnySchema,
  CollectionName,
  EncodedQuery,
  EncodedWhereClause,
  Mutation,
  Patch,
  PatchSetOp,
} from "@tandem/types";
import type { RemoteStore } from "@tandem/server";
import * as errore from "errore";

export class PluginStorageStoreError extends errore.createTaggedError({
  name: "PluginStorageStoreError",
  message: "Plugin storage failed for $pluginId",
}) {}

const storeRowSchema = Type.Object(
  { id: Type.Union([Type.String(), Type.Number()]) },
  { additionalProperties: true },
);
const storeCollectionSchema = Type.Record(Type.String(), storeRowSchema);
const storeSnapshotSchema = Type.Record(Type.String(), storeCollectionSchema);

type StoreRow = Static<typeof storeRowSchema>;
type StoreSnapshot = Static<typeof storeSnapshotSchema>;

type CollectionRecords<Schema extends AnySchema> = Map<
  string | number,
  Schema[CollectionName<Schema>]
>;

export class FileRemoteStore<
  Schema extends AnySchema = AnySchema,
> implements RemoteStore<Schema> {
  private constructor(
    private readonly pluginId: string,
    private readonly path: string,
    private readonly recordsByCollection: Map<
      CollectionName<Schema>,
      CollectionRecords<Schema>
    >,
  ) {}

  static open<Schema extends AnySchema>(args: {
    pluginId: string;
    workspaceRoot: string;
    collections: readonly string[];
  }): PluginStorageStoreError | FileRemoteStore<Schema> {
    const path = storePath(args.workspaceRoot, args.pluginId);
    const records = readStore<Schema>(path, args.pluginId);
    if (records instanceof PluginStorageStoreError) return records;
    for (const collection of args.collections) {
      if (records.has(collection)) continue;
      records.set(collection, new Map());
    }
    return new FileRemoteStore(args.pluginId, path, records);
  }

  applyMutations(mutations: Mutation<Schema>[]): Promise<void> {
    for (const mutation of mutations) {
      for (const op of mutation.ops) {
        if (op.type === "set") {
          let collectionRecords = this.recordsByCollection.get(op.collection);
          if (collectionRecords === undefined) {
            collectionRecords = new Map();
            this.recordsByCollection.set(op.collection, collectionRecords);
          }
          collectionRecords.set(op.value.id, op.value);
          continue;
        }
        this.recordsByCollection.get(op.collection)?.delete(op.id);
      }
    }
    return persistStore(
      this.path,
      this.pluginId,
      this.recordsByCollection,
    ).then((written) => {
      if (written instanceof Error) throw written;
    });
  }

  readSnapshot(
    snapshotQueries: EncodedQuery<Schema>[],
  ): Promise<Patch<Schema>> {
    const set: PatchSetOp<Schema>[] = [];
    for (const query of snapshotQueries) {
      for (const row of this.readRows(query)) {
        // SAFETY: readRows returns Schema[Collection] for query.collection.
        set.push({
          collection: query.collection,
          value: row,
        } as PatchSetOp<Schema>);
      }
    }
    return Promise.resolve({ set });
  }

  private readRows<Collection extends CollectionName<Schema>>(
    query: EncodedQuery<Schema, Collection>,
  ): Schema[Collection][] {
    const stored = this.recordsByCollection.get(query.collection);
    // SAFETY: rows stored under Collection are Schema[Collection].
    const rows: Schema[Collection][] = stored
      ? ([...stored.values()] as Schema[Collection][])
      : [];
    const matched = rows.filter((record) => matchesWhere(record, query.where));
    const ordered =
      query.order === undefined || query.order.length === 0
        ? matched
        : matched.toSorted(compareByOrder(query.order));
    const afterOffset =
      query.offset === undefined ? ordered : ordered.slice(query.offset);
    if (query.limit === undefined) return afterOffset;
    return afterOffset.slice(0, query.limit);
  }
}

function storePath(workspaceRoot: string, pluginId: string) {
  return join(workspaceRoot, ".halo", "plugin-data", pluginId, "store.json");
}

function matchesWhere<
  Schema extends AnySchema,
  Collection extends CollectionName<Schema>,
>(
  record: Schema[Collection],
  where: EncodedWhereClause<Schema, Collection>[] | undefined,
) {
  if (where === undefined) return true;
  return where.every(([field, operator, value]) => {
    const fieldValue = record[field];
    if (operator === "=") return Object.is(fieldValue, value);
    if (operator === ">") return fieldValue > value;
    if (operator === "<") return fieldValue < value;
    if (operator === ">=") return fieldValue >= value;
    if (operator === "<=") return fieldValue <= value;
    return false;
  });
}

function compareByOrder<Schema extends AnySchema>(
  order: NonNullable<EncodedQuery<Schema>["order"]>,
) {
  return (
    left: Schema[CollectionName<Schema>],
    right: Schema[CollectionName<Schema>],
  ) => {
    for (const [field, direction] of order) {
      const leftValue = left[field];
      const rightValue = right[field];
      if (Object.is(leftValue, rightValue)) continue;
      const result = leftValue > rightValue ? 1 : -1;
      return direction === "asc" ? result : -result;
    }
    return 0;
  };
}

function readStore<Schema extends AnySchema>(
  path: string,
  pluginId: string,
):
  | PluginStorageStoreError
  | Map<CollectionName<Schema>, CollectionRecords<Schema>> {
  if (!existsSync(path)) {
    return new Map<CollectionName<Schema>, CollectionRecords<Schema>>();
  }
  const raw = errore.try({
    try: () => readFileSync(path, "utf8"),
    catch: (e) => new PluginStorageStoreError({ pluginId, cause: e }),
  });
  if (raw instanceof Error) return raw;
  const parsed = errore.try({
    try: () => {
      // SAFETY: JSON.parse is untyped; storeSnapshotSchema is the file contract.
      return JSON.parse(raw) as unknown;
    },
    catch: (e) => new PluginStorageStoreError({ pluginId, cause: e }),
  });
  if (parsed instanceof PluginStorageStoreError) return parsed;
  if (!Value.Check(storeSnapshotSchema, parsed)) {
    return new PluginStorageStoreError({ pluginId });
  }
  return snapshotToRecords<Schema>(parsed);
}

function snapshotToRecords<Schema extends AnySchema>(snapshot: StoreSnapshot) {
  const records = new Map<CollectionName<Schema>, CollectionRecords<Schema>>();
  for (const [collection, rows] of Object.entries(snapshot)) {
    const collectionRecords: CollectionRecords<Schema> = new Map();
    for (const row of Object.values(rows)) {
      // SAFETY: storeRowSchema requires id; remaining fields are the plugin row.
      collectionRecords.set(row.id, row as Schema[CollectionName<Schema>]);
    }
    records.set(collection, collectionRecords);
  }
  return records;
}

async function persistStore<Schema extends AnySchema>(
  path: string,
  pluginId: string,
  recordsByCollection: Map<CollectionName<Schema>, CollectionRecords<Schema>>,
) {
  const created = await mkdir(dirname(path), { recursive: true }).catch(
    (e) => new PluginStorageStoreError({ pluginId, cause: e }),
  );
  if (created instanceof Error) return created;
  const snapshot: StoreSnapshot = {};
  for (const [collection, rows] of recordsByCollection) {
    const collectionOut: Record<string, StoreRow> = {};
    for (const [id, row] of rows) {
      // SAFETY: every stored row is a plugin record with an id field.
      collectionOut[String(id)] = row as StoreRow;
    }
    snapshot[collection] = collectionOut;
  }
  return writeFile(path, `${JSON.stringify(snapshot)}\n`).catch(
    (e) => new PluginStorageStoreError({ pluginId, cause: e }),
  );
}
