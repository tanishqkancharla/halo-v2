import { describe, expect, test } from "vitest";
import type { AgentMessage } from "./rpc.js";
import {
  lastAssistantTurnWasAborted,
  legacyStateToSessionLog,
  projectSession,
  type SessionLogEvent,
  type ToolIdentity,
  type ToolInvocation,
} from "./sessionLog.js";

const emptyUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
};

function assistantMessage(
  overrides: Partial<Extract<AgentMessage, { role: "assistant" }>> &
    Pick<Extract<AgentMessage, { role: "assistant" }>, "stopReason">,
): Extract<AgentMessage, { role: "assistant" }> {
  return {
    role: "assistant",
    content: [],
    api: "google-generative-ai",
    provider: "google-vertex",
    model: "gemini-3-pro-preview",
    usage: emptyUsage,
    timestamp: 1,
    ...overrides,
  };
}

function userMessage(text: string, timestamp: number): AgentMessage {
  return {
    role: "user",
    content: text,
    timestamp,
  };
}

describe("projectSession", () => {
  test("projects every prefix of committed messages", () => {
    const user = userMessage("hello", 1);
    const assistant = assistantMessage({
      stopReason: "stop",
      content: [{ type: "text", text: "hi" }],
      timestamp: 2,
    });
    const events: SessionLogEvent[] = [
      { type: "message.committed", message: user },
      { type: "message.committed", message: assistant },
    ];

    expect(projectSession(events.slice(0, 0)).messages).toEqual([]);
    expect(projectSession(events.slice(0, 1)).messages).toEqual([user]);
    expect(projectSession(events).messages).toEqual([user, assistant]);
  });

  test("reconstructs the latest assistant update from stream deltas", () => {
    const started = assistantMessage({ stopReason: "stop", timestamp: 2 });
    const updated = assistantMessage({
      stopReason: "stop",
      content: [{ type: "text", text: "Hello" }],
      timestamp: 2,
    });
    const events: SessionLogEvent[] = [
      { type: "run.started", runId: "run-1" },
      {
        type: "assistant.updated",
        runId: "run-1",
        update: { type: "start", partial: started },
      },
      {
        type: "assistant.updated",
        runId: "run-1",
        update: {
          type: "text_delta",
          contentIndex: 0,
          delta: "Hello",
          partial: updated,
        },
      },
    ];

    expect(projectSession(events.slice(0, 2)).streamingMessage).toEqual(
      started,
    );
    expect(projectSession(events).streamingMessage).toEqual(updated);
    expect(projectSession(events).isWorking).toBe(true);
  });

  test("projects readable assistant errors", () => {
    const failed = assistantMessage({
      stopReason: "error",
      errorMessage: JSON.stringify({
        error: { message: "API keys are not supported by this API." },
      }),
    });

    expect(
      projectSession([{ type: "message.committed", message: failed }]).error,
    ).toBe("API keys are not supported by this API.");
  });

  test("keeps aborted turns in the transcript without an error", () => {
    const aborted = assistantMessage({
      stopReason: "aborted",
      errorMessage: "Request was aborted",
    });
    const state = projectSession([
      { type: "message.committed", message: aborted },
    ]);

    expect(state.error).toBeUndefined();
    expect(lastAssistantTurnWasAborted(state.messages)).toBe(true);
  });

  test("tracks direct tool lifecycle prefixes", () => {
    const tool = {
      path: "files.read",
      displayName: "Read",
    } satisfies ToolIdentity;
    const invocation = {
      id: "tool-1",
      runId: "run-1",
      tool,
      arguments: { path: "README.md" },
    } satisfies ToolInvocation;
    const events: SessionLogEvent[] = [
      { type: "run.started", runId: "run-1" },
      { type: "tool.started", invocation },
      {
        type: "tool.updated",
        invocationId: invocation.id,
        update: { bytesRead: 10 },
      },
      {
        type: "tool.finished",
        invocationId: invocation.id,
        result: {
          content: [{ type: "text", text: "contents" }],
          details: {},
        },
        isError: false,
      },
    ];

    expect(projectSession(events.slice(0, 2)).activeInvocations).toEqual([
      { invocation },
    ]);
    expect(projectSession(events.slice(0, 3)).activeInvocations).toEqual([
      { invocation, update: { bytesRead: 10 } },
    ]);
    expect(projectSession(events).activeInvocations).toEqual([]);
  });

  test("a new run supersedes interrupted work", () => {
    const invocation: ToolInvocation = {
      id: "tool-1",
      runId: "run-1",
      tool: { path: "bash", displayName: "Shell" },
      arguments: { command: "sleep 10" },
    };
    const interrupted: SessionLogEvent[] = [
      { type: "run.started", runId: "run-1" },
      { type: "tool.started", invocation },
      { type: "run.started", runId: "run-2" },
    ];

    const restarted = projectSession(interrupted);
    expect(restarted.isWorking).toBe(true);
    expect(restarted.activeInvocations).toEqual([]);
    expect(
      projectSession([...interrupted, { type: "run.finished", runId: "run-2" }])
        .isWorking,
    ).toBe(false);
  });
});

test("legacyStateToSessionLog preserves the current renderer state", () => {
  const committed = userMessage("hello", 1);
  const streaming = assistantMessage({
    stopReason: "stop",
    content: [{ type: "text", text: "partial" }],
    timestamp: 2,
  });
  const legacy = {
    messages: [committed],
    streamingMessage: streaming,
    error: "local prompt failure",
    isWorking: true,
  };

  const projected = projectSession(legacyStateToSessionLog(legacy));
  expect(projected).toMatchObject(legacy);
});
