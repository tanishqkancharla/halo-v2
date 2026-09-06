import { afterEach, describe, expect, test } from "vitest";
import { call } from "@orpc/server";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AnySchema,
  ClientId,
  Mutation,
  MutationId,
  RuntimeSchemaDefinition,
  SetMutationOp,
} from "@tanishqkancharla/tandem-core";
import { syncRoutes, type PluginServerContext } from "./server.js";

type Schema = { todos: { id: string; text: string; done: boolean } };

// syncRoutes only reads Object.keys(tables.collections) at runtime, so a
// minimal collection definition suffices (no need for tandem-core's runtime
// schema builder). The annotation supplies the precise type directly.
const tables: RuntimeSchemaDefinition<Schema> = {
  collections: {
    todos: { kind: "collection" as const, name: "todos" },
  },
};

function serverContext(tmp: string, pluginId: string): PluginServerContext {
  return {
    pluginId,
    workspaceRoot: tmp,
    // SAFETY: the sync handlers only read pluginId/workspaceRoot and never
    // dereference tools, so an absent facade cannot affect behavior here.
    tools: undefined as never,
  };
}

async function seedStore(tmp: string, pluginId: string) {
  const pluginDir = join(tmp, ".halo", "plugin-data", pluginId);
  await mkdir(pluginDir, { recursive: true });
  await writeFile(join(pluginDir, "store.json"), "{}", "utf8");
}

function asClientId(id: string): ClientId {
  // SAFETY: ClientId is a branded Tagged<"ClientId", string>; the runtime
  // value is an unchanged plain string, so the cast only attaches the brand.
  return id as ClientId;
}

function asMutation(id: string, row: Schema["todos"]): Mutation<AnySchema> {
  const op: SetMutationOp<AnySchema> = {
    type: "set",
    collection: "todos",
    value: row,
  };
  // SAFETY: MutationId is a branded Tagged<"MutationId", string>; the runtime
  // value is an unchanged plain string, so the cast only attaches the brand.
  return { id: id as MutationId, ops: [op] };
}

type PokeIter = AsyncIterable<{ type: "poke" }>;

type Handle = {
  iter: PokeIter;
  close: () => Promise<void>;
};

// Abort controllers for streams that haven't been explicitly closed; aborted in
// afterEach as a safety net so a connect iterator never blocks the test run.
const liveAcs = new Set<AbortController>();

afterEach(() => {
  for (const ac of liveAcs) ac.abort();
  liveAcs.clear();
});

function open(iter: PokeIter, ac: AbortController): Handle {
  liveAcs.add(ac);
  return {
    iter,
    close: async () => {
      ac.abort();
      try {
        for await (const _ of iter) void _;
      } catch {
        // aborting the connect iterator rejects its `values` read; expected
      }
      liveAcs.delete(ac);
    },
  };
}

// Narrow a connect call's result to a stream handle, throwing (failing the
// test) if the handler returned an error instead of a poke iterator.
function asHandle(iter: PokeIter | Error, ac: AbortController): Handle {
  if (iter instanceof Error) throw iter;
  return open(iter, ac);
}

async function closeAll(handles: readonly Handle[]) {
  await Promise.all(handles.map((h) => h.close()));
}

describe("syncRoutes", () => {
  test("two concurrent connects keep both clients able to push", async () => {
    const tmp = await mkdtemp(join("/tmp/opencode", "race-push-"));
    const pluginId = "race-push";
    await seedStore(tmp, pluginId);
    try {
      const routes = syncRoutes<Schema>(tables);
      const ctx = serverContext(tmp, pluginId);

      // Two clients connect CONCURRENTLY on a fresh plugin. Both race
      // pluginRemote(): with the bug each sees `remote === undefined`, each
      // awaits FileRemoteStore.open, each assigns its own RemoteServer — the
      // last writer wins and the other client's registration is orphaned.
      const acA = new AbortController();
      const acB = new AbortController();
      const [iterA, iterB] = await Promise.all([
        call(
          routes.sync.connect,
          { clientId: asClientId("A") },
          { context: ctx, signal: acA.signal },
        ),
        call(
          routes.sync.connect,
          { clientId: asClientId("B") },
          { context: ctx, signal: acB.signal },
        ),
      ]);
      const handles = [asHandle(iterA, acA), asHandle(iterB, acB)];

      const [pushA, pushB] = await Promise.all([
        call(
          routes.sync.push,
          {
            clientId: asClientId("A"),
            mutations: [asMutation("m1", { id: "t1", text: "a", done: false })],
          },
          { context: ctx },
        ),
        call(
          routes.sync.push,
          {
            clientId: asClientId("B"),
            mutations: [asMutation("m2", { id: "t2", text: "b", done: false })],
          },
          { context: ctx },
        ),
      ]);

      expect([pushA, pushB].filter((r) => r instanceof Error)).toEqual([]);
      await closeAll(handles);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
