import { describe, expect, test } from "vitest";
import { coalesceAssistantMessages } from "../shared/coalesceAssistantMessages.js";

describe("coalesceAssistantMessages", () => {
  test("merges adjacent assistant tool rounds into one feed row", () => {
    expect(
      coalesceAssistantMessages([
        {
          id: "u1",
          role: "user",
          text: "read then list",
          toolCalls: [],
          timestamp: "1",
        },
        {
          id: "a1",
          role: "assistant",
          text: "",
          toolCalls: [{ id: "t1", kind: "read", path: "notes.txt" }],
          timestamp: "2",
        },
        {
          id: "a2",
          role: "assistant",
          text: "",
          toolCalls: [{ id: "t2", kind: "shell", command: "ls -1" }],
          timestamp: "3",
        },
        {
          id: "a3",
          role: "assistant",
          text: "Done.",
          toolCalls: [],
          timestamp: "4",
        },
      ]),
    ).toEqual([
      {
        id: "u1",
        role: "user",
        text: "read then list",
        toolCalls: [],
        timestamp: "1",
      },
      {
        id: "a1",
        role: "assistant",
        text: "Done.",
        toolCalls: [
          { id: "t1", kind: "read", path: "notes.txt" },
          { id: "t2", kind: "shell", command: "ls -1" },
        ],
        timestamp: "2",
      },
    ]);
  });

  test("keeps separate turns when a user message sits between assistants", () => {
    expect(
      coalesceAssistantMessages([
        {
          id: "a1",
          role: "assistant",
          text: "first",
          toolCalls: [{ id: "t1", kind: "read", path: "a.ts" }],
          timestamp: "1",
        },
        {
          id: "u1",
          role: "user",
          text: "again",
          toolCalls: [],
          timestamp: "2",
        },
        {
          id: "a2",
          role: "assistant",
          text: "second",
          toolCalls: [{ id: "t2", kind: "wrote", path: "b.ts" }],
          timestamp: "3",
        },
      ]),
    ).toEqual([
      {
        id: "a1",
        role: "assistant",
        text: "first",
        toolCalls: [{ id: "t1", kind: "read", path: "a.ts" }],
        timestamp: "1",
      },
      {
        id: "u1",
        role: "user",
        text: "again",
        toolCalls: [],
        timestamp: "2",
      },
      {
        id: "a2",
        role: "assistant",
        text: "second",
        toolCalls: [{ id: "t2", kind: "wrote", path: "b.ts" }],
        timestamp: "3",
      },
    ]);
  });
});
