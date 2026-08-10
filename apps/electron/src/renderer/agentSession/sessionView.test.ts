import { describe, expect, test } from "vitest";
import type { AgentMessage } from "../../shared/rpc.js";
import type { AgentSessionState } from "../../shared/AgentSessionState.js";
import {
  execJsSource,
  sessionViewItems,
  toolPartLabel,
} from "./sessionView.js";

const usage = {
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

function assistant(
  content: Extract<AgentMessage, { role: "assistant" }>["content"],
): AgentMessage {
  return {
    role: "assistant",
    content,
    api: "openai-completions",
    provider: "openai",
    model: "test",
    usage,
    stopReason: "toolUse",
    timestamp: 1,
  };
}

function toolResult(
  toolCallId: string,
  text: string,
): Extract<AgentMessage, { role: "toolResult" }> {
  return {
    role: "toolResult",
    toolCallId,
    toolName: "exec",
    content: [{ type: "text", text }],
    isError: false,
    timestamp: 2,
  };
}

describe("sessionViewItems", () => {
  test("attaches exec tool result text to the tool part", () => {
    const state: AgentSessionState = {
      messages: [
        {
          role: "user",
          content: "run it",
          timestamp: 0,
        },
        assistant([
          {
            type: "toolCall",
            id: "call-1",
            name: "exec",
            arguments: { js: 'return "hi"' },
          },
        ]),
        toolResult("call-1", '"hi"'),
      ],
      streamingMessage: null,
      error: null,
    };

    const items = sessionViewItems(state);
    const turn = items[1];
    expect(turn?.kind).toBe("assistantTurn");
    if (turn?.kind !== "assistantTurn") return;
    expect(turn.parts).toEqual([
      {
        kind: "tool",
        id: "call-1",
        toolName: "exec",
        args: { js: 'return "hi"' },
        resultText: '"hi"',
      },
    ]);
  });
});

describe("toolPartLabel", () => {
  test("labels exec as Exec", () => {
    expect(toolPartLabel({ toolName: "exec", args: { js: "1 + 1" } })).toEqual({
      kind: "exec",
      text: "Exec",
    });
  });
});

describe("execJsSource", () => {
  test("reads the js argument", () => {
    expect(execJsSource({ js: "return 1" })).toBe("return 1");
  });
});
