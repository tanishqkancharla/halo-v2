import { describe, expect, test } from "vitest";
import type { AgentMessage } from "./rpc.js";
import {
  agentSessionStateFromSession,
  applyAgentSessionEvent,
  emptyAgentSessionState,
  lastAssistantTurnWasAborted,
} from "./AgentSessionState.js";

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

describe("applyAgentSessionEvent", () => {
  test("sets state.error from assistant message_end with stopReason error", () => {
    const state = emptyAgentSessionState();
    const message = assistantMessage({
      stopReason: "error",
      errorMessage: "Vertex request failed",
      content: [],
      timestamp: 2,
    });

    const next = applyAgentSessionEvent(state, {
      type: "message_end",
      message,
    });

    expect(next.error).toBe("Vertex request failed");
    expect(next.messages).toEqual([message]);
    expect(next.streamingMessage).toBeUndefined();
  });

  test("extracts Google-style nested JSON errorMessage for the alert", () => {
    const state = emptyAgentSessionState();
    const nested = JSON.stringify({
      error: {
        code: 401,
        message:
          "API keys are not supported by this API. Expected OAuth2 access token or other authentication credentials that assert a principal.",
        status: "UNAUTHENTICATED",
      },
    });
    const message = assistantMessage({
      stopReason: "error",
      errorMessage: nested,
      content: [],
      timestamp: 3,
    });

    const next = applyAgentSessionEvent(state, {
      type: "message_end",
      message,
    });

    expect(next.error).toBe(
      "API keys are not supported by this API. Expected OAuth2 access token or other authentication credentials that assert a principal.",
    );
  });

  test("keeps raw errorMessage when it is not useful JSON", () => {
    const state = emptyAgentSessionState();
    const message = assistantMessage({
      stopReason: "error",
      errorMessage: "{not-json",
      content: [],
      timestamp: 4,
    });

    const next = applyAgentSessionEvent(state, {
      type: "message_end",
      message,
    });

    expect(next.error).toBe("{not-json");
  });

  test("does not treat a user abort as a composer error", () => {
    const state = emptyAgentSessionState();
    const message = assistantMessage({
      stopReason: "aborted",
      errorMessage: "Request was aborted",
      content: [],
      timestamp: 5,
    });

    const next = applyAgentSessionEvent(state, {
      type: "message_end",
      message,
    });

    expect(next.error).toBeUndefined();
    expect(next.messages).toEqual([message]);
    expect(lastAssistantTurnWasAborted(next.messages)).toBe(true);
  });

  test("clears the abort annotation when the user sends another message", () => {
    const aborted = assistantMessage({
      stopReason: "aborted",
      errorMessage: "Request was aborted",
      content: [],
      timestamp: 5,
    });
    const state = applyAgentSessionEvent(emptyAgentSessionState(), {
      type: "message_end",
      message: aborted,
    });
    const next = applyAgentSessionEvent(state, {
      type: "message_start",
      message: userMessage("try again", 6),
    });

    expect(lastAssistantTurnWasAborted(next.messages)).toBe(false);
  });

  test("does not invent an alert when stopReason is error without errorMessage", () => {
    const state = emptyAgentSessionState();
    const message = assistantMessage({
      stopReason: "error",
      content: [],
      timestamp: 6,
    });

    const next = applyAgentSessionEvent(state, {
      type: "message_end",
      message,
    });

    expect(next.error).toBeUndefined();
    expect(next.messages).toEqual([message]);
  });

  test("leaves state.error unchanged on a successful assistant message_end", () => {
    const state = {
      ...emptyAgentSessionState(),
      error: "previous failure",
    };
    const message = assistantMessage({
      stopReason: "stop",
      content: [{ type: "text", text: "ok" }],
      timestamp: 7,
    });

    const next = applyAgentSessionEvent(state, {
      type: "message_end",
      message,
    });

    expect(next.error).toBe("previous failure");
  });

  test("ignores hidden custom messages so they never become a bubble", () => {
    const state = emptyAgentSessionState();
    const custom = {
      role: "custom" as const,
      customType: "halo.integration.connected",
      content: "[System] The user connected Gmail.",
      display: false,
      timestamp: 8,
    };

    expect(
      applyAgentSessionEvent(state, { type: "message_start", message: custom }),
    ).toEqual(state);
    expect(
      applyAgentSessionEvent(state, { type: "message_end", message: custom }),
    ).toEqual(state);
  });

  test("sets isWorking on agent_start and clears it on agent_end", () => {
    const started = applyAgentSessionEvent(emptyAgentSessionState(), {
      type: "agent_start",
    });
    expect(started.isWorking).toBe(true);

    const ended = applyAgentSessionEvent(started, {
      type: "agent_end",
      messages: [],
    });
    expect(ended.isWorking).toBe(false);
  });
});

describe("agentSessionStateFromSession", () => {
  test("surfaces error from the last durable assistant turn", () => {
    const failed = assistantMessage({
      stopReason: "error",
      errorMessage: JSON.stringify({
        error: {
          message: "API keys are not supported by this API.",
          status: "UNAUTHENTICATED",
        },
      }),
      content: [],
      timestamp: 20,
    });
    const state = agentSessionStateFromSession({
      messages: [userMessage("hello", 10), failed],
      isStreaming: false,
    });

    expect(state.error).toBe("API keys are not supported by this API.");
    expect(state.messages).toEqual([userMessage("hello", 10), failed]);
    expect(state.streamingMessage).toBeUndefined();
    expect(state.isWorking).toBe(false);
  });

  test("does not surface an aborted durable assistant turn as an error", () => {
    const aborted = assistantMessage({
      stopReason: "aborted",
      errorMessage: "Request was aborted",
      content: [{ type: "text", text: "partial" }],
      timestamp: 20,
    });
    const state = agentSessionStateFromSession({
      messages: [userMessage("hello", 10), aborted],
      isStreaming: false,
    });

    expect(state.error).toBeUndefined();
    expect(state.messages).toEqual([userMessage("hello", 10), aborted]);
    expect(lastAssistantTurnWasAborted(state.messages)).toBe(true);
  });

  test("does not surface an earlier error when the last assistant turn succeeded", () => {
    const failed = assistantMessage({
      stopReason: "error",
      errorMessage: "old failure",
      content: [],
      timestamp: 20,
    });
    const ok = assistantMessage({
      stopReason: "stop",
      content: [{ type: "text", text: "recovered" }],
      timestamp: 40,
    });
    const state = agentSessionStateFromSession({
      messages: [userMessage("one", 10), failed, userMessage("two", 30), ok],
      isStreaming: false,
    });

    expect(state.error).toBeUndefined();
  });

  test("returns no error when the session has no assistant messages", () => {
    const state = agentSessionStateFromSession({
      messages: [userMessage("hello", 1)],
      isStreaming: false,
    });
    expect(state.error).toBeUndefined();
    expect(state.isWorking).toBe(false);
  });

  test("peels the last assistant into streamingMessage when isStreaming", () => {
    const assistant = assistantMessage({
      stopReason: "stop",
      content: [{ type: "text", text: "hi" }],
      timestamp: 2,
    });
    const state = agentSessionStateFromSession({
      messages: [userMessage("hello", 1), assistant],
      isStreaming: true,
    });

    expect(state.messages).toEqual([userMessage("hello", 1)]);
    expect(state.streamingMessage).toEqual(assistant);
    expect(state.isWorking).toBe(true);
    expect(state.error).toBeUndefined();
  });

  test("keeps isWorking when streaming with no assistant yet", () => {
    const state = agentSessionStateFromSession({
      messages: [userMessage("hello", 1)],
      isStreaming: true,
    });

    expect(state.messages).toEqual([userMessage("hello", 1)]);
    expect(state.streamingMessage).toBeUndefined();
    expect(state.isWorking).toBe(true);
  });
});
