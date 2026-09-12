import assert from "node:assert/strict";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ServerProcess } from "@opencode/server/process";
import { Effect } from "effect";
import type { HttpServer } from "effect/unstable/http";
import { messageText, ScriptedModel } from "./ScriptedModel.js";

type InitialResult = {
  clientRuntime: string;
  phase: "initial";
  sessionID: string;
  liveEvents: string[];
  workspaceSkills: string[];
};

type RestoredResult = {
  clientRuntime: string;
  phase: "restored";
  durableEvents: string[];
  restored: true;
  queuedAndSteered: true;
  interrupted: true;
};

const workspaceRoot = path.resolve(import.meta.dir, "../../..");
const databasePath = path.resolve(import.meta.dir, "../network-spike.db");
const password = "halo-network-spike";
const pluginURL = pathToFileURL(
  path.resolve(import.meta.dir, "executorBridge"),
).href;

await Promise.all([
  fsPromises.rm(databasePath, { force: true }),
  fsPromises.rm(`${databasePath}-shm`, { force: true }),
  fsPromises.rm(`${databasePath}-wal`, { force: true }),
]);
const scriptedModel = new ScriptedModel({ port: 0 });
const config = JSON.stringify({
  model: "halo/scripted",
  plugins: [pluginURL],
  providers: {
    halo: {
      name: "Halo scripted",
      package: "@opencode/ai/providers/openai-compatible",
      settings: {
        apiKey: "halo-spike",
        baseURL: scriptedModel.baseURL,
      },
      models: {
        scripted: {
          name: "Scripted",
          limit: { context: 128_000, output: 16_000 },
        },
      },
    },
  },
});

const initial = await withServer((baseURL) =>
  runDeviceClient({ phase: "initial", baseURL }),
);
const restored = await withServer((baseURL) =>
  runDeviceClient({
    phase: "restored",
    baseURL,
    sessionID: initial.sessionID,
  }),
);

const mainRequest = scriptedModel.requests.find(
  (request) =>
    messageText(request.messages[0]).includes("tools.halo.integration") &&
    request.messages.some((message) => message.role === "user") &&
    request.messages.some((message) => message.role === "tool"),
);
assert.notEqual(mainRequest, undefined);
assert.equal(JSON.stringify(mainRequest).includes("gmail.search"), true);
assert.equal(
  messageText(mainRequest?.messages[0]).includes(
    "Halo is an open-source self-modifiable desktop app",
  ),
  true,
);

await scriptedModel.close();
console.log(
  JSON.stringify(
    {
      result: "pass",
      topology: "Bun OpenCode server over HTTP -> Node device client",
      serverRuntime: `Bun ${Bun.version}`,
      clientRuntime: initial.clientRuntime,
      sessionID: initial.sessionID,
      liveEvents: initial.liveEvents,
      durableEvents: restored.durableEvents,
      executorCalls: [{ operation: "gmail.search" }],
      restored: restored.restored,
      queuedAndSteered: restored.queuedAndSteered,
      interrupted: restored.interrupted,
      workspaceInstructions: true,
      workspaceSkills: initial.workspaceSkills,
    },
    undefined,
    2,
  ),
);

async function withServer<T>(run: (baseURL: string) => Promise<T>) {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const server = yield* ServerProcess.start<never, never>({
          app: { name: "halo-opencode-network-spike", version: "0.0.0" },
          hostname: "127.0.0.1",
          port: 0,
          password,
          database: { path: databasePath },
          events: { persist: true },
          models: { fetch: false },
          config: { content: config },
          fs: { filewatcher: false, fff: false },
        });
        return yield* Effect.promise(() => run(serverOrigin(server.address)));
      }),
    ),
  );
}

async function runDeviceClient(input: {
  phase: "initial";
  baseURL: string;
}): Promise<InitialResult>;
async function runDeviceClient(input: {
  phase: "restored";
  baseURL: string;
  sessionID: string;
}): Promise<RestoredResult>;
async function runDeviceClient(input: {
  phase: "initial" | "restored";
  baseURL: string;
  sessionID?: string;
}) {
  const childArguments = [
    "node",
    "--experimental-strip-types",
    path.resolve(import.meta.dir, "DeviceClient.ts"),
    input.phase,
    input.baseURL,
    password,
  ];
  if (input.sessionID !== undefined) childArguments.push(input.sessionID);

  const child = Bun.spawn(childArguments, {
    cwd: workspaceRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  assert.equal(exitCode, 0, stderr);
  // SAFETY: DeviceClient emits exactly one JSON object matching its selected phase.
  return JSON.parse(stdout) as InitialResult | RestoredResult;
}

function serverOrigin(address: HttpServer.Address) {
  assert.ok("port" in address);
  const hostname = address.hostname.includes(":")
    ? `[${address.hostname}]`
    : address.hostname;
  return `http://${hostname}:${address.port}`;
}
