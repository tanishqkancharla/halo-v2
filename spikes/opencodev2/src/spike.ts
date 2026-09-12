import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { Plugin } from "@opencode/plugin";
import { OpenCode, type OpenCodeEvent } from "@opencode/sdk";

type OpenCodeHost = OpenCode.Interface;
type ChatMessage = {
  role: string;
  content?: unknown;
};
type ChatRequest = {
  model: string;
  messages: ChatMessage[];
};
type ExecutorCall = {
  operation: string;
};
type CompletionDelta = {
  role?: string;
  content?: string;
  tool_calls?: Array<{
    index: number;
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
};

class ScriptedModel {
  // Records requests so the spike can inspect the real model boundary.
  readonly requests: ChatRequest[] = [];

  // Hosts the local OpenAI-compatible model endpoint.
  private readonly server: Bun.Server<undefined>;

  // Resolves once a deliberately blocked model request reaches the server.
  private blocked = false;

  // Releases the blocked response after OpenCode interrupts its run.
  private releaseBlockedResponse: (() => void) | undefined;

  constructor(ctx: { port: number }) {
    const { port } = ctx;
    this.server = Bun.serve({
      port,
      fetch: (request) => this.respond(request),
    });
  }

  get baseURL() {
    return `http://127.0.0.1:${this.server.port}/v1`;
  }

  get isBlocked() {
    return this.blocked;
  }

  async close() {
    this.releaseBlockedResponse?.();
    await this.server.stop(true);
  }

  releaseBlocked() {
    this.releaseBlockedResponse?.();
  }

  private async respond(request: Request): Promise<Response> {
    // SAFETY: This private test server only receives requests from the configured OpenCode client.
    const input = (await request.json()) as ChatRequest;
    this.requests.push(input);
    const system = messageText(input.messages[0]);
    if (system.includes("title generator"))
      return textResponse(input.model, ["OpenCode migration spike"]);

    const user = input.messages
      .toReversed()
      .find((message) => message.role === "user");
    const prompt = messageText(user);
    const hasToolResult = input.messages.some(
      (message) => message.role === "tool",
    );
    if (prompt.includes("integration") && !hasToolResult) {
      return toolResponse(input.model, "execute", {
        code: 'return await tools.halo.integration({ operation: "gmail.search" })',
      });
    }
    if (hasToolResult)
      return textResponse(input.model, ["Executor bridge complete."]);
    if (prompt.includes("block")) return this.block(request, input.model);
    return textResponse(input.model, ["Hello ", "from OpenCode."]);
  }

  private block(request: Request, model: string): Promise<Response> {
    this.blocked = true;
    return new Promise((resolve) => {
      const release = () =>
        resolve(textResponse(model, ["Released after interrupt."]));
      this.releaseBlockedResponse = release;
      request.signal.addEventListener("abort", release, { once: true });
    });
  }
}

const workspaceRoot = path.resolve(import.meta.dir, "../../..");
const databasePath = path.resolve(import.meta.dir, "../spike.db");
await Promise.all([
  rm(databasePath, { force: true }),
  rm(`${databasePath}-shm`, { force: true }),
  rm(`${databasePath}-wal`, { force: true }),
]);

const executorCalls: ExecutorCall[] = [];
const executorBridge = Plugin.define({
  id: "halo.executor.bridge",
  async setup(context) {
    await context.tool.transform((editor) => {
      editor.namespace({
        name: "halo",
        description: "Halo integration tools backed by Executor.",
      });
      editor.add({
        name: "integration",
        description: "Call a connected Halo integration through Executor.",
        input: {
          type: "object",
          properties: { operation: { type: "string" } },
          required: ["operation"],
          additionalProperties: false,
        },
        options: { namespace: "halo", codemode: true },
        async execute(input, tool) {
          // SAFETY: OpenCode validates tool input against the object schema above before execution.
          const call = input as ExecutorCall;
          executorCalls.push(call);
          await tool.progress({ phase: "executor.invoke" });
          return {
            content: JSON.stringify({ ok: true, operation: call.operation }),
            metadata: { backend: "executor" },
          };
        },
      });
    });
  },
});

const scriptedModel = new ScriptedModel({ port: 0 });
const firstHost = await createHost(scriptedModel);
const workspaceLocation = { directory: workspaceRoot };
await firstHost.plugin.awaitActivation({ location: workspaceLocation });
assert.equal((await firstHost.health.get()).healthy, true);
assert.equal(
  (await firstHost.plugin.check({ location: workspaceLocation })).data.some(
    (plugin) =>
      plugin.id === "halo.executor.bridge" && plugin.state.status === "active",
  ),
  true,
);

const skills = await firstHost.skill.list({
  location: { directory: workspaceRoot },
});
assert.equal(
  skills.data.some((skill) => skill.id === "errore"),
  true,
  JSON.stringify(skills.data.map((skill) => skill.id)),
);

const session = await firstHost.sessions.create({
  title: "OpenCode spike",
  agent: "build",
  model: { providerID: "halo", id: "scripted" },
  location: { directory: workspaceRoot },
});
const firstEvents = collectEvents(firstHost, session.id);
await firstHost.sessions.prompt({
  sessionID: session.id,
  text: "Use the integration bridge",
  resume: true,
});
await waitFor("Executor-backed tool completion", async () => {
  const context = await firstHost.sessions.context({ sessionID: session.id });
  return assistantText(context).includes("Executor bridge complete.");
});
assert.deepEqual(executorCalls, [{ operation: "gmail.search" }]);
await waitFor("stream and tool events", () =>
  Promise.resolve(
    [
      "session.execution.started",
      "session.tool.called",
      "session.tool.progress",
      "session.tool.success",
      "session.text.delta",
      "session.execution.succeeded",
    ].every((type) => firstEvents.types.includes(type)),
  ),
);

const mainRequest = scriptedModel.requests.find(
  (request) =>
    messageText(request.messages[0]).includes("tools.halo.integration") &&
    request.messages.some((message) => message.role === "user"),
);
assert.notEqual(mainRequest, undefined);
assert.equal(
  messageText(mainRequest?.messages[0]).includes(
    "Halo is an open-source self-modifiable desktop app",
  ),
  true,
);

await firstHost.sessions.synthetic({
  sessionID: session.id,
  text: "Google integration connected",
  description: "halo.integration.connected",
  metadata: { customType: "halo.integration.connected" },
  resume: false,
});
await firstHost.sessions.rename({
  sessionID: session.id,
  title: "Migrated session",
});
const listed = await firstHost.sessions.list({
  directory: workspaceRoot,
});
assert.equal(
  listed.data.some(
    (item) => item.id === session.id && item.title === "Migrated session",
  ),
  true,
);
assert.equal(
  (await firstHost.sessions.inbox.list({ sessionID: session.id })).some(
    (item) =>
      item.type === "synthetic" &&
      item.payload.metadata?.customType === "halo.integration.connected",
  ),
  true,
);

await firstEvents.stop();
await firstHost.close();

const restoredHost = await createHost(scriptedModel);
await restoredHost.plugin.awaitActivation({ location: workspaceLocation });
const restoredSessions = await restoredHost.sessions.list({
  directory: workspaceRoot,
});
assert.equal(
  restoredSessions.data.some((item) => item.id === session.id),
  true,
);
assert.equal(
  assistantText(
    await restoredHost.sessions.context({ sessionID: session.id }),
  ).includes("Executor bridge complete."),
  true,
);

const durableEvents: string[] = [];
for await (const item of restoredHost.sessions.log({
  sessionID: session.id,
  after: 0,
  follow: false,
})) {
  if (item.type !== "log.synced") durableEvents.push(item.type);
}
assert.equal(durableEvents.includes("session.tool.success"), true);
assert.equal(durableEvents.includes("session.execution.succeeded"), true);

const controlSession = await restoredHost.sessions.create({
  title: "Control flow",
  agent: "build",
  model: { providerID: "halo", id: "scripted" },
  location: { directory: workspaceRoot },
});
const controlEvents = collectEvents(restoredHost, controlSession.id);
await restoredHost.sessions.prompt({
  sessionID: controlSession.id,
  text: "block this run",
  resume: true,
});
await waitFor("blocked model request", () =>
  Promise.resolve(scriptedModel.isBlocked),
);
const queued = await restoredHost.sessions.prompt({
  sessionID: controlSession.id,
  text: "steer with this message",
  delivery: "queue",
  resume: false,
});
assert.equal(queued.delivery, "queue");
await restoredHost.sessions.inbox.steer({
  sessionID: controlSession.id,
  inboxID: queued.id,
});
await waitFor("queued prompt changed to steer", async () =>
  (
    await restoredHost.sessions.inbox.list({ sessionID: controlSession.id })
  ).some((item) => item.id === queued.id && item.delivery === "steer"),
);
const interrupted = await restoredHost.sessions.interrupt({
  sessionID: controlSession.id,
});
assert.equal(interrupted.interrupted, true);
scriptedModel.releaseBlocked();
await waitFor("interrupt event", () =>
  Promise.resolve(
    controlEvents.types.includes("session.execution.interrupted"),
  ),
);

await controlEvents.stop();
await restoredHost.close();
await scriptedModel.close();

console.log(
  JSON.stringify(
    {
      result: "pass",
      runtime: `Bun ${Bun.version}`,
      sessionID: session.id,
      liveEvents: firstEvents.types,
      durableEvents,
      executorCalls,
      restored: true,
      queuedAndSteered: true,
      interrupted: true,
      workspaceInstructions: true,
      workspaceSkills: skills.data
        .filter((skill) =>
          ["errore", "halo-app", "halo-extension", "testing"].includes(
            skill.id,
          ),
        )
        .map((skill) => skill.id),
    },
    undefined,
    2,
  ),
);

async function createHost(modelServer: ScriptedModel) {
  const config = {
    model: "halo/scripted",
    providers: {
      halo: {
        name: "Halo scripted",
        package: "@opencode/ai/providers/openai-compatible",
        settings: {
          apiKey: "halo-spike",
          baseURL: modelServer.baseURL,
        },
        models: {
          scripted: {
            name: "Scripted",
            limit: { context: 128_000, output: 16_000 },
          },
        },
      },
    },
  };
  return OpenCode.create({
    app: { name: "halo-opencode-spike", version: "0.0.0" },
    database: { path: databasePath },
    events: { persist: true },
    models: { fetch: false },
    config: { content: JSON.stringify(config) },
    fs: { filewatcher: false, fff: false },
    plugins: [executorBridge],
  });
}

function collectEvents(host: OpenCodeHost, sessionID: string) {
  const controller = new AbortController();
  const types: string[] = [];
  const consuming = (async () => {
    for await (const event of host.events.subscribe({
      signal: controller.signal,
    })) {
      if (eventSessionID(event) === sessionID) types.push(event.type);
    }
  })();
  return {
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
  if (typeof data !== "object" || data === null || !("sessionID" in data))
    return undefined;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- The external event payload is not narrowed by its event type.
  return typeof data.sessionID === "string" ? data.sessionID : undefined;
}

function assistantText(
  context: Awaited<ReturnType<OpenCodeHost["sessions"]["context"]>>,
) {
  return context
    .filter((message) => message.type === "assistant")
    .flatMap((message) => message.content)
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("\n");
}

function messageText(message: ChatMessage | undefined) {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- OpenAI message content may be text or structured content.
  if (message === undefined || typeof message.content !== "string") return "";
  return message.content;
}

async function waitFor(description: string, predicate: () => Promise<boolean>) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await Bun.sleep(25);
  }
  assert.fail(`Timed out waiting for ${description}`);
}

function textResponse(model: string, text: string[]) {
  const id = crypto.randomUUID();
  return eventStream([
    chunk(id, model, { role: "assistant" }),
    ...text.map((part) => chunk(id, model, { content: part })),
    chunk(id, model, {}, "stop"),
  ]);
}

function toolResponse(model: string, name: string, input: { code: string }) {
  const id = crypto.randomUUID();
  return eventStream([
    chunk(id, model, { role: "assistant" }),
    chunk(id, model, {
      tool_calls: [
        {
          index: 0,
          id: `call_${crypto.randomUUID()}`,
          type: "function",
          function: { name, arguments: JSON.stringify(input) },
        },
      ],
    }),
    chunk(id, model, {}, "tool_calls"),
  ]);
}

function eventStream(chunks: string[]) {
  return new Response(`${chunks.join("")}data: [DONE]\n\n`, {
    headers: { "content-type": "text/event-stream" },
  });
}

function chunk(
  id: string,
  model: string,
  delta: CompletionDelta,
  finishReason?: string,
) {
  return `data: ${JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta,
        // oxlint-disable-next-line unicorn/no-null -- OpenAI streaming requires JSON null before the final chunk.
        finish_reason: finishReason === undefined ? null : finishReason,
      },
    ],
  })}\n\n`;
}
