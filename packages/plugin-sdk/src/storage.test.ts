import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRouterClient } from "@orpc/server";
import { TandemClient } from "@tandem/core";
import { expect, test } from "vitest";
import { orpcSyncRemote } from "./OrpcSyncRemote.js";
import { syncRoutes } from "./server.js";
import { collection, defineSchema, t } from "./storage.js";

const todoTables = defineSchema({
  todos: collection({
    id: t.id(),
    title: t.string(),
    done: t.boolean(),
  }),
});

const milk = { id: "t1", title: "Buy milk", done: false };

const todoTest = test.extend<{ root: string }>({
  root: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-store-${task.id}-`));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
});

todoTest("round-trips a todo through syncRoutes", async ({ root }) => {
  const client = todoClient(root);
  await client.ready;
  await client.connect();
  const subscription = client.subscribe({ collection: "todos" }, () => {});
  const tx = client.transact();
  tx.set("todos", milk);
  await client.commit(tx);
  await client.pullFromRemote();
  expect(client.query({ collection: "todos" })).toEqual([milk]);
  subscription.destroy();
  await client.disconnect();
});

todoTest("a second client pulls the first client's row", async ({ root }) => {
  const sync = todoSync(root);
  const writer = tandemClient(sync);
  await writer.ready;
  await writer.connect();
  const writerSubscription = writer.subscribe(
    { collection: "todos" },
    () => {},
  );
  const tx = writer.transact();
  tx.set("todos", milk);
  await writer.commit(tx);

  const reader = tandemClient(sync);
  await reader.ready;
  await reader.connect();
  const readerSubscription = reader.subscribe(
    { collection: "todos" },
    () => {},
  );
  await reader.pullFromRemote();
  expect(reader.query({ collection: "todos" })).toEqual([milk]);

  writerSubscription.destroy();
  readerSubscription.destroy();
  await writer.disconnect();
  await reader.disconnect();
});

function todoClient(root: string) {
  return tandemClient(todoSync(root));
}

function todoSync(root: string) {
  const routes = syncRoutes(todoTables);
  const rpc = createRouterClient(routes, {
    context: { pluginId: "todos", workspaceRoot: root },
  });
  return rpc.sync;
}

function tandemClient(sync: Parameters<typeof orpcSyncRemote>[0]) {
  return new TandemClient({
    schema: todoTables,
    remote: orpcSyncRemote(sync),
    autoConnect: false,
  });
}
