import { describe, expect, test } from "vitest";
import { collectToolCalls, toolCallFromPi } from "../shared/ToolCall.js";

describe("toolCallFromPi", () => {
  test("maps read, write, edit, and bash", () => {
    expect(toolCallFromPi("1", "read", { path: "a.ts" })).toEqual({
      id: "1",
      kind: "read",
      path: "a.ts",
    });
    expect(toolCallFromPi("2", "write", { path: "b.ts", content: "x" })).toEqual(
      {
        id: "2",
        kind: "wrote",
        path: "b.ts",
      },
    );
    expect(
      toolCallFromPi("3", "edit", {
        path: "c.ts",
        oldText: "a",
        newText: "b",
      }),
    ).toEqual({
      id: "3",
      kind: "wrote",
      path: "c.ts",
    });
    expect(toolCallFromPi("4", "bash", { command: "ls" })).toEqual({
      id: "4",
      kind: "shell",
      command: "ls",
    });
  });

  test("returns null for unknown tools or missing fields", () => {
    expect(toolCallFromPi("1", "grep", { pattern: "x" })).toBeNull();
    expect(toolCallFromPi("2", "read", {})).toBeNull();
    expect(toolCallFromPi("3", "bash", { path: "x" })).toBeNull();
    expect(toolCallFromPi("4", "read", null)).toBeNull();
  });
});

describe("collectToolCalls", () => {
  test("collects toolCall content blocks from an assistant message", () => {
    expect(
      collectToolCalls([
        { type: "text", text: "hi" },
        {
          type: "toolCall",
          id: "tc-1",
          name: "read",
          arguments: { path: "MainPane.tsx" },
        },
        {
          type: "toolCall",
          id: "tc-2",
          name: "bash",
          arguments: { command: "pnpm test" },
        },
      ]),
    ).toEqual([
      { id: "tc-1", kind: "read", path: "MainPane.tsx" },
      { id: "tc-2", kind: "shell", command: "pnpm test" },
    ]);
  });

  test("skips non-arrays and unmapped tools", () => {
    expect(collectToolCalls("plain")).toEqual([]);
    expect(
      collectToolCalls([
        {
          type: "toolCall",
          id: "tc-1",
          name: "grep",
          arguments: { pattern: "x" },
        },
      ]),
    ).toEqual([]);
  });
});
