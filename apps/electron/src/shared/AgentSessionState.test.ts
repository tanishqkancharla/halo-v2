import { describe, expect, test } from "vitest";
import type { AgentMessage } from "./rpc.js";
import {
  agentSessionStateFromSession,
  applyAgentSessionEvent,
  emptyAgentSessionState,
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
    expect(next.streamingMessage).toBeNull();
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

  test("sets state.error from non-empty errorMessage even without stopReason error", () => {
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

    expect(next.error).toBe("Request was aborted");
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

    expect(next.error).toBeNull();
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
    });

    expect(state.error).toBe("API keys are not supported by this API.");
    expect(state.messages).toEqual([userMessage("hello", 10), failed]);
    expect(state.streamingMessage).toBeNull();
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
    });

    expect(state.error).toBeNull();
  });

  test("returns null error when the session has no assistant messages", () => {
    const state = agentSessionStateFromSession({
      messages: [userMessage("hello", 1)],
    });
    expect(state.error).toBeNull();
  });
});
