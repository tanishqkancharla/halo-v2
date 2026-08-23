import { describe, expect, test } from "vitest";
import type { AgentMessage } from "../../shared/rpc.js";
import { emptyAgentSessionState } from "../../shared/AgentSessionState.js";
import { sessionViewItems, toolPartLabel } from "./sessionView.js";

const workspaceRoot = "/home/ubuntu/halo-workspace";

describe("toolPartLabel", () => {
  test("read labels strip the workspace root prefix", () => {
    expect(
      toolPartLabel(
        {
          toolName: "read",
          args: { path: `${workspaceRoot}/src/renderer/App.tsx` },
        },
        workspaceRoot,
      ),
    ).toEqual({ kind: "read", text: "src/renderer/App.tsx" });
  });

  test("write and edit labels strip the workspace root prefix", () => {
    expect(
      toolPartLabel(
        { toolName: "write", args: { path: `${workspaceRoot}/notes.md` } },
        workspaceRoot,
      ),
    ).toEqual({ kind: "wrote", text: "notes.md" });
    expect(
      toolPartLabel(
        { toolName: "edit", args: { path: `${workspaceRoot}/src/a.ts` } },
        workspaceRoot,
      ),
    ).toEqual({ kind: "wrote", text: "src/a.ts" });
  });

  test("shows . when the path is the workspace root", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: workspaceRoot } },
        workspaceRoot,
      ),
    ).toEqual({ kind: "read", text: "." });
  });

  test("leaves paths outside the workspace unchanged", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: "/etc/hosts" } },
        workspaceRoot,
      ),
    ).toEqual({ kind: "read", text: "/etc/hosts" });
    expect(
      toolPartLabel(
        {
          toolName: "read",
          args: { path: "/home/ubuntu/halo-workspace-other/a.ts" },
        },
        workspaceRoot,
      ),
    ).toEqual({
      kind: "read",
      text: "/home/ubuntu/halo-workspace-other/a.ts",
    });
  });

  test("leaves relative paths unchanged", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: "src/App.tsx" } },
        workspaceRoot,
      ),
    ).toEqual({ kind: "read", text: "src/App.tsx" });
  });

  test("strips a trailing slash on the workspace root", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: `${workspaceRoot}/src/a.ts` } },
        `${workspaceRoot}/`,
      ),
    ).toEqual({ kind: "read", text: "src/a.ts" });
  });

  test("normalizes backslashes when stripping", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: "C:\\proj\\src\\a.ts" } },
        "C:\\proj",
      ),
    ).toEqual({ kind: "read", text: "src/a.ts" });
  });

  test("keeps the original path when workspace root is missing", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: `${workspaceRoot}/src/a.ts` } },
        undefined,
      ),
    ).toEqual({ kind: "read", text: `${workspaceRoot}/src/a.ts` });
  });
});

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
  content: Extract<AgentMessage, { role: "assistant" }>["content"],
  timestamp: number,
): Extract<AgentMessage, { role: "assistant" }> {
  return {
    role: "assistant",
    content,
    api: "google-generative-ai",
    provider: "google-vertex",
    model: "gemini-3-pro-preview",
    usage: emptyUsage,
    stopReason: "toolUse",
    timestamp,
  };
}

function toolResult(
  toolCallId: string,
  toolName: string,
  text: string,
  timestamp: number,
): Extract<AgentMessage, { role: "toolResult" }> {
  return {
    role: "toolResult",
    toolCallId,
    toolName,
    content: [{ type: "text", text }],
    isError: false,
    timestamp,
  };
}

describe("sessionViewItems", () => {
  test("projects integrations_connect into an integrationConnect part", () => {
    const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
    const items = sessionViewItems({
      ...emptyAgentSessionState(),
      messages: [
        {
          role: "user",
          content: "access my gmail",
          timestamp: 1,
        },
        assistantMessage(
          [
            {
              type: "toolCall",
              id: "call-1",
              name: "integrations_connect",
              arguments: { service: "gmail", scopes },
            },
          ],
          2,
        ),
        toolResult(
          "call-1",
          "integrations_connect",
          JSON.stringify({
            status: "pending",
            intent: "connect",
            connectionId: "conn-1",
            service: "gmail",
            profile: "default",
            scopes,
          }),
          3,
        ),
      ],
    });

    expect(items).toEqual([
      { kind: "user", id: "user-1", text: "access my gmail" },
      {
        kind: "assistantTurn",
        id: "assistant-2",
        parts: [
          {
            kind: "integrationConnect",
            id: "call-1",
            connectionId: "conn-1",
            service: "gmail",
            scopes,
            intent: "connect",
          },
        ],
      },
    ]);
  });

  test("keeps other tools as kind tool", () => {
    const items = sessionViewItems({
      ...emptyAgentSessionState(),
      messages: [
        assistantMessage(
          [
            {
              type: "toolCall",
              id: "call-2",
              name: "integrations_catalog",
              arguments: { service: "gmail" },
            },
          ],
          4,
        ),
        toolResult(
          "call-2",
          "integrations_catalog",
          JSON.stringify({ services: [] }),
          5,
        ),
      ],
    });

    expect(items).toEqual([
      {
        kind: "assistantTurn",
        id: "assistant-4",
        parts: [
          {
            kind: "tool",
            id: "call-2",
            toolName: "integrations_catalog",
            args: { service: "gmail" },
            resultText: JSON.stringify({ services: [] }),
          },
        ],
      },
    ]);
  });

  test("keeps a connect error as kind tool", () => {
    const items = sessionViewItems({
      ...emptyAgentSessionState(),
      messages: [
        assistantMessage(
          [
            {
              type: "toolCall",
              id: "call-3",
              name: "integrations_connect",
              arguments: { service: "gmail", scopes: [] },
            },
          ],
          6,
        ),
        toolResult(
          "call-3",
          "integrations_connect",
          JSON.stringify({
            error: "Nothing to disconnect. gmail is not connected.",
          }),
          7,
        ),
      ],
    });

    expect(items[0]).toMatchObject({
      kind: "assistantTurn",
      parts: [
        {
          kind: "tool",
          id: "call-3",
          toolName: "integrations_connect",
        },
      ],
    });
  });

  test("reads upgrade intent from the tool result", () => {
    const scopes = ["https://www.googleapis.com/auth/gmail.send"];
    const items = sessionViewItems({
      ...emptyAgentSessionState(),
      messages: [
        assistantMessage(
          [
            {
              type: "toolCall",
              id: "call-4",
              name: "integrations_connect",
              arguments: { service: "gmail", scopes },
            },
          ],
          8,
        ),
        toolResult(
          "call-4",
          "integrations_connect",
          JSON.stringify({
            status: "pending",
            intent: "upgrade",
            connectionId: "conn-2",
            service: "gmail",
            profile: "default",
            scopes,
          }),
          9,
        ),
      ],
    });

    expect(items[0]).toMatchObject({
      parts: [
        {
          kind: "integrationConnect",
          connectionId: "conn-2",
          intent: "upgrade",
          scopes,
        },
      ],
    });
  });
});
