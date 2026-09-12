import assert from "node:assert/strict";
import { OpenCode, type OpenCodeEvent } from "@opencode/client";

type Client = ReturnType<typeof OpenCode.make>;

const [phase, baseURL, password, restoredSessionID] = process.argv.slice(2);
assert.ok(phase === "initial" || phase === "restored");
assert.ok(baseURL !== undefined);
assert.ok(password !== undefined);

const deviceClient = OpenCode.make({
  baseUrl: baseURL,
  headers: {
    authorization: `Basic ${btoa(`opencode:${password}`)}`,
  },
});

assert.equal((await deviceClient.health.get()).healthy, true);
const result =
  phase === "initial"
    ? await runInitial(deviceClient)
    : await runRestored(deviceClient, restoredSessionID);

console.log(
  JSON.stringify({
    clientRuntime: `Node ${process.version}`,
    ...result,
  }),
);

async function runInitial(client: Client) {
  const workspaceRoot = process.cwd();
  const location = { directory: workspaceRoot };
  await client.plugin.awaitActivation({ location });
  assert.equal(
    (await client.plugin.check({ location })).data.some(
      (plugin) =>
        plugin.id === "halo.executor.bridge" &&
        plugin.state.status === "active",
    ),
    true,
  );

  const skills = await client.skill.list({ location });
  assert.equal(
    skills.data.some((skill) => skill.id === "errore"),
    true,
    JSON.stringify(skills.data.map((skill) => skill.id)),
  );

  const session = await client.session.create({
    title: "OpenCode network spike",
    agent: "build",
    model: { providerID: "halo", id: "scripted" },
    location,
  });
  const events = collectEvents(client, session.id);
  await events.ready;
  await client.session.prompt({
    sessionID: session.id,
    text: "Use the integration bridge",
    resume: true,
  });
  await waitFor("Executor-backed tool completion", async () => {
    const context = await client.session.context({ sessionID: session.id });
    return assistantText(context).includes("Executor bridge complete.");
  });
  await waitFor("stream and tool events", () =>
    Promise.resolve(
      [
        "session.execution.started",
        "session.tool.called",
        "session.tool.progress",
        "session.tool.success",
        "session.text.delta",
        "session.execution.succeeded",
      ].every((type) => events.types.includes(type)),
    ),
  );

  await client.session.synthetic({
    sessionID: session.id,
    text: "Google integration connected",
    description: "halo.integration.connected",
    metadata: { customType: "halo.integration.connected" },
    resume: false,
  });
  await client.session.rename({
    sessionID: session.id,
    title: "Migrated network session",
  });
  assert.equal(
    (
      await client.session.list({
        directory: workspaceRoot,
      })
    ).data.some(
      (item) =>
        item.id === session.id && item.title === "Migrated network session",
    ),
    true,
  );
  assert.equal(
    (await client.session.inbox.list({ sessionID: session.id })).some(
      (item) =>
        item.type === "synthetic" &&
        item.payload.metadata?.customType === "halo.integration.connected",
    ),
    true,
  );

  await events.stop();
  return {
    phase: "initial",
    sessionID: session.id,
    liveEvents: events.types,
    workspaceSkills: skills.data
      .filter((skill) =>
        ["errore", "halo-app", "halo-extension", "testing"].includes(skill.id),
      )
      .map((skill) => skill.id),
  };
}

async function runRestored(client: Client, sessionID: string | undefined) {
  assert.ok(sessionID !== undefined);
  const workspaceRoot = process.cwd();
  const location = { directory: workspaceRoot };
  await client.plugin.awaitActivation({ location });
  assert.equal(
    (await client.session.list({ directory: workspaceRoot })).data.some(
      (item) => item.id === sessionID,
    ),
    true,
  );
  assert.equal(
    assistantText(await client.session.context({ sessionID })).includes(
      "Executor bridge complete.",
    ),
    true,
  );

  const durableEvents: string[] = [];
  for await (const item of client.session.log({
    sessionID,
    after: 0,
    follow: false,
  })) {
    if (item.type !== "log.synced") durableEvents.push(item.type);
  }
  assert.equal(durableEvents.includes("session.tool.success"), true);
  assert.equal(durableEvents.includes("session.execution.succeeded"), true);

  const controlSession = await client.session.create({
    title: "Network control flow",
    agent: "build",
    model: { providerID: "halo", id: "scripted" },
    location,
  });
  const controlEvents = collectEvents(client, controlSession.id);
  await controlEvents.ready;
  await client.session.prompt({
    sessionID: controlSession.id,
    text: "block this run",
    resume: true,
  });
  await waitFor("active execution", async () => {
    const active = await client.session.active();
    return controlSession.id in active;
  });
  const queued = await client.session.prompt({
    sessionID: controlSession.id,
    text: "steer with this message",
    delivery: "queue",
    resume: false,
  });
  assert.equal(queued.delivery, "queue");
  await client.session.inbox.steer({
    sessionID: controlSession.id,
    inboxID: queued.id,
  });
  await waitFor("queued prompt changed to steer", async () =>
    (await client.session.inbox.list({ sessionID: controlSession.id })).some(
      (item) => item.id === queued.id && item.delivery === "steer",
    ),
  );
  assert.equal(
    (
      await client.session.interrupt({
        sessionID: controlSession.id,
      })
    ).interrupted,
    true,
  );
  await waitFor("interrupt event", () =>
    Promise.resolve(
      controlEvents.types.includes("session.execution.interrupted"),
    ),
  );

  await controlEvents.stop();
  return {
    phase: "restored",
    durableEvents,
    restored: true,
    queuedAndSteered: true,
    interrupted: true,
  };
}

function collectEvents(client: Client, sessionID: string) {
  const controller = new AbortController();
  const connected = Promise.withResolvers<void>();
  const types: string[] = [];
  const consuming = (async () => {
    for await (const event of client.event.subscribe({
      signal: controller.signal,
    })) {
      if (event.type === "server.connected") connected.resolve();
      if (eventSessionID(event) === sessionID) types.push(event.type);
    }
  })();
  return {
    ready: connected.promise,
    types,
    async stop() {
      controller.abort();
      await consuming;
    },
  };
}

function eventSessionID(event: OpenCodeEvent): string | undefined {
  const data: unknown = event.data;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- OpenCode's generated event union exposes several data shapes.
  if (typeof data !== "object" || data === null || !("sessionID" in data)) {
    return undefined;
  }
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- The external event payload is not narrowed by its event type.
  return typeof data.sessionID === "string" ? data.sessionID : undefined;
}

function assistantText(
  context: Awaited<ReturnType<Client["session"]["context"]>>,
) {
  return context
    .filter((message) => message.type === "assistant")
    .flatMap((message) => message.content)
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("\n");
}

async function waitFor(description: string, predicate: () => Promise<boolean>) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`Timed out waiting for ${description}`);
}
