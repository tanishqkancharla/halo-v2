import { describe, expect, test } from "vitest";
import {
  agentSessionStateFromSession,
  applyAgentSessionEvent,
  emptyAgentSessionState,
} from "../shared/AgentSessionState.js";

describe("applyAgentSessionEvent", () => {
  test("tracks user and assistant messages from the Pi event stream", () => {
    let state = emptyAgentSessionState();

    state = applyAgentSessionEvent(state, {
      type: "message_start",
      message: {
        role: "user",
        content: "read notes",
        timestamp: 1,
      },
    });
    state = applyAgentSessionEvent(state, {
      type: "message_start",
      message: {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "t1",
            name: "read",
            arguments: { path: "notes.txt" },
          },
        ],
        api: "openai-completions",
        provider: "openai",
        model: "test",
        usage: {
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
        },
        stopReason: "toolUse",
        timestamp: 2,
      },
    });
    state = applyAgentSessionEvent(state, {
      type: "message_end",
      message: {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "t1",
            name: "read",
            arguments: { path: "notes.txt" },
          },
        ],
        api: "openai-completions",
        provider: "openai",
        model: "test",
        usage: {
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
        },
        stopReason: "toolUse",
        timestamp: 2,
      },
    });
    state = applyAgentSessionEvent(state, {
      type: "message_end",
      message: {
        role: "toolResult",
        toolCallId: "t1",
        toolName: "read",
        content: [{ type: "text", text: "hi" }],
        isError: false,
        timestamp: 3,
      },
    });
    state = applyAgentSessionEvent(state, {
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Done." }],
        api: "openai-completions",
        provider: "openai",
        model: "test",
        usage: {
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
        },
        stopReason: "stop",
        timestamp: 4,
      },
    });

    expect(state.messages).toHaveLength(4);
    expect(state.streamingMessage).toBeNull();
    expect(state.error).toBeNull();
  });
});

describe("agentSessionStateFromSession", () => {
  test("loads durable messages without streaming state", () => {
    const state = agentSessionStateFromSession({
      messages: [
        {
          role: "user",
          content: "hi",
          timestamp: 1,
        },
      ],
    });

    expect(state.messages).toHaveLength(1);
    expect(state.streamingMessage).toBeNull();
    expect(state.error).toBeNull();
  });
});
