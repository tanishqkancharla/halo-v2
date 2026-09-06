import path from "node:path";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import { expect, test as baseTest } from "vitest";
import { createTestArtifacts } from "../../test/TestArtifacts.js";
import { adaptPiEvent } from "./SessionLogAdapter.js";
import { createDurableStream, type DurableStream } from "../DurableStream.js";
import { FilesystemService } from "../filesystem/FilesystemService.js";
import { JsonlDurableStreamStorage } from "../JsonlDurableStreamStorage.js";
import {
  sessionLogEventSchema,
  type SessionLogEvent,
  type ToolIdentity,
} from "@get-halo/shared/sessionLog";

const test = baseTest.extend<{ streamFile: string }>({
  streamFile: async ({ task }, use) => {
    const artifacts = await createTestArtifacts(task.id);
    await using cleanup = new errore.AsyncDisposableStack();
    cleanup.defer(() =>
      artifacts.finish({ passed: task.result?.state === "pass" }),
    );
    await use(path.join(artifacts.paths.workspace, "events.jsonl"));
  },
});

const haloToolIdentities = new Map<string, ToolIdentity>([
  ["read", { path: "read", displayName: "Read" }],
  ["edit", { path: "edit", displayName: "Edit" }],
  ["write", { path: "write", displayName: "Write" }],
  ["patch", { path: "patch", displayName: "Patch" }],
  ["bash", { path: "bash", displayName: "Bash" }],
  ["exec", { path: "exec", displayName: "Exec" }],
]);

test("adaptPiEvent uses the registered ToolIdentity for a known tool name", () => {
  const adapted = adaptPiEvent({
    state: { activeRunId: "run-1" },
    toolIdentities: haloToolIdentities,
    event: {
      type: "tool_execution_start",
      toolCallId: "tool-1",
      toolName: "read",
      args: { path: "foo" },
    },
  });

  expect(adapted.events).toHaveLength(1);
  const event = adapted.events[0];
  if (event === undefined) throw new Error("expected a tool.started event");
  expect(event.type).toBe("tool.started");
  if (event.type !== "tool.started") throw new Error("unreachable");
  expect(event.invocation.tool).toEqual({ path: "read", displayName: "Read" });
  expect(Value.Check(sessionLogEventSchema, event)).toBe(true);
});

test("adaptPiEvent synthesizes a schema-valid ToolIdentity for a tool name absent from toolIdentities", () => {
  const adapted = adaptPiEvent({
    state: { activeRunId: "run-1" },
    toolIdentities: haloToolIdentities,
    event: {
      type: "tool_execution_start",
      toolCallId: "tool-1",
      toolName: "mcp__filesystem__read_file",
      args: { path: "foo" },
    },
  });

  expect(adapted.events).toHaveLength(1);
  const event = adapted.events[0];
  if (event === undefined) throw new Error("expected a tool.started event");
  expect(event.type).toBe("tool.started");
  if (event.type !== "tool.started") throw new Error("unreachable");
  expect(event.invocation.tool).toEqual({
    path: "mcp__filesystem__read_file",
    displayName: "mcp__filesystem__read_file",
  });
  expect(Value.Check(sessionLogEventSchema, event)).toBe(true);
});

test("an extension tool's tool.started persists and keeps the durable stream healthy", async ({
  streamFile,
}) => {
  const events = await openEventStream(streamFile);
  const received: unknown[] = [];
  const unsubscribe = events.subscribe((record) => {
    received.push(record);
  });

  const adapted = adaptPiEvent({
    state: { activeRunId: "run-1" },
    toolIdentities: haloToolIdentities,
    event: {
      type: "tool_execution_start",
      toolCallId: "tool-1",
      toolName: "mcp__filesystem__read_file",
      args: { path: "foo" },
    },
  });

  const started = adapted.events[0];
  if (started === undefined) throw new Error("expected a tool.started event");
  expect(Value.Check(sessionLogEventSchema, started)).toBe(true);

  await expect(events.append(started)).resolves.toEqual({
    sequence: 1,
    value: started,
  });
  await expect(
    events.append({
      type: "run.finished",
      runId: "run-1",
      outcome: "completed",
    }),
  ).resolves.toEqual({
    sequence: 2,
    value: { type: "run.finished", runId: "run-1", outcome: "completed" },
  });

  expect(events.snapshot()).toHaveLength(2);
  expect(received).toHaveLength(2);

  const reopened = await openEventStream(streamFile);
  expect(reopened.snapshot()).toEqual(events.snapshot());

  unsubscribe();
});

async function openEventStream(
  streamFile: string,
): Promise<DurableStream<SessionLogEvent>> {
  const stream = await createDurableStream({
    storage: new JsonlDurableStreamStorage({
      filesystem: new FilesystemService(),
      path: streamFile,
      valueSchema: sessionLogEventSchema,
    }),
  });
  if (stream instanceof Error) throw stream;
  return stream;
}
