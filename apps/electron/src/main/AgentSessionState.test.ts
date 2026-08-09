import { describe, expect, test } from "vitest";
import {
  applyAgentSessionEvent,
  emptyAgentSessionState,
} from "../renderer/agentSession/AgentSessionState.js";

describe("applyAgentSessionEvent", () => {
  test("tracks user, tools, and assistant text like Pi's event stream", () => {
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
      type: "tool_execution_start",
      toolCallId: "t1",
      toolName: "read",
      args: { path: "notes.txt" },
    });
    state = applyAgentSessionEvent(state, {
      type: "message_start",
      message: {
        role: "assistant",
        content: [],
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
        timestamp: 2,
      },
    });
    state = applyAgentSessionEvent(state, {
      type: "message_update",
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
        timestamp: 2,
      },
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 0,
        delta: "Done.",
        partial: {
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
          timestamp: 2,
        },
      },
    });
    state = applyAgentSessionEvent(state, {
      type: "tool_execution_end",
      toolCallId: "t1",
      toolName: "read",
      result: { content: [{ type: "text", text: "hi" }] },
      isError: false,
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
        timestamp: 2,
      },
    });

    expect(state.messages).toHaveLength(2);
    expect(state.streamingMessage).toBeNull();
    expect(state.tools.t1).toEqual({
      toolCallId: "t1",
      toolName: "read",
      args: { path: "notes.txt" },
      result: { content: [{ type: "text", text: "hi" }] },
      isError: false,
      isPartial: false,
    });
  });
});
