import path from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { ConnectionRequest } from "@get-halo/shared/connectionRequests";
import type { AgentMessage } from "@get-halo/shared/rpc";
import * as errore from "errore";

type ToolArguments = { [key in string]: string };

export type SessionDescription = {
  title: string;
  messages: SessionDescriptionItem[];
};

type SessionDescriptionItem =
  | { type: "user"; text: string }
  | { type: "assistant"; text: string }
  | {
      type: "tool";
      name: string;
      arguments: ToolArguments;
      result: string;
    }
  | { type: "connectionRequest"; request: ConnectionRequest };

export const m = {
  user(text: string) {
    return { type: "user" as const, text };
  },
  assistant(text: string) {
    return { type: "assistant" as const, text };
  },
  read(input: { path: string; result: string }) {
    return {
      type: "tool" as const,
      name: "read",
      arguments: { path: input.path },
      result: input.result,
    };
  },
  edit(input: {
    path: string;
    oldText: string;
    newText: string;
    result: string;
  }) {
    return {
      type: "tool" as const,
      name: "edit",
      arguments: {
        path: input.path,
        oldText: input.oldText,
        newText: input.newText,
      },
      result: input.result,
    };
  },
  write(input: { path: string; content: string; result: string }) {
    return {
      type: "tool" as const,
      name: "write",
      arguments: { path: input.path, content: input.content },
      result: input.result,
    };
  },
  patch(input: { patchText: string; result: string }) {
    return {
      type: "tool" as const,
      name: "patch",
      arguments: { patchText: input.patchText },
      result: input.result,
    };
  },
  bash(input: { command: string; result: string }) {
    return {
      type: "tool" as const,
      name: "bash",
      arguments: { command: input.command },
      result: input.result,
    };
  },
  connectionRequest(request: ConnectionRequest) {
    return { type: "connectionRequest" as const, request };
  },
};

class LoadSessionError extends errore.createTaggedError({
  name: "LoadSessionError",
  message: "Could not load the described E2E session",
}) {}

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

export function loadSessionDescription(args: {
  description: SessionDescription;
  workspaceRoot: string;
}) {
  return errore.try({
    try: () => {
      const manager = SessionManager.create(
        args.workspaceRoot,
        path.join(args.workspaceRoot, ".pi", "agent", "sessions"),
      );
      manager.appendSessionInfo(args.description.title);
      const startTime = Date.now();
      for (const [index, item] of args.description.messages.entries()) {
        appendDescriptionItem({
          manager,
          item,
          timestamp: startTime + index * 2,
        });
      }
      return { sessionId: manager.getSessionId() };
    },
    catch: (cause) => new LoadSessionError({ cause }),
  });
}

function appendDescriptionItem(args: {
  manager: SessionManager;
  item: SessionDescriptionItem;
  timestamp: number;
}): void {
  if (args.item.type === "user") {
    args.manager.appendMessage({
      role: "user",
      content: args.item.text,
      timestamp: args.timestamp,
    });
    return;
  }

  if (args.item.type === "assistant") {
    args.manager.appendMessage(
      assistantMessage({
        content: [{ type: "text", text: args.item.text }],
        stopReason: "stop",
        timestamp: args.timestamp,
      }),
    );
    return;
  }

  if (args.item.type === "tool") {
    appendTool({
      manager: args.manager,
      name: args.item.name,
      arguments: args.item.arguments,
      result: args.item.result,
      details: undefined,
      timestamp: args.timestamp,
    });
    return;
  }

  appendTool({
    manager: args.manager,
    name: "exec",
    arguments: { js: "" },
    result: "Connection required",
    details: { connectionRequests: [args.item.request] },
    timestamp: args.timestamp,
  });
}

function appendTool(args: {
  manager: SessionManager;
  name: string;
  arguments: ToolArguments;
  result: string;
  details: { connectionRequests: ConnectionRequest[] } | undefined;
  timestamp: number;
}): void {
  const toolCallId = `tool-${args.timestamp}`;
  args.manager.appendMessage(
    assistantMessage({
      content: [
        {
          type: "toolCall",
          id: toolCallId,
          name: args.name,
          arguments: args.arguments,
        },
      ],
      stopReason: "toolUse",
      timestamp: args.timestamp,
    }),
  );
  args.manager.appendMessage({
    role: "toolResult",
    toolCallId,
    toolName: args.name,
    content: [{ type: "text", text: args.result }],
    details: args.details,
    isError: false,
    timestamp: args.timestamp + 1,
  });
}

function assistantMessage(args: {
  content: Extract<AgentMessage, { role: "assistant" }>["content"];
  stopReason: Extract<AgentMessage, { role: "assistant" }>["stopReason"];
  timestamp: number;
}): Extract<AgentMessage, { role: "assistant" }> {
  return {
    role: "assistant",
    content: args.content,
    api: "openai-codex-responses",
    provider: "openai-codex",
    model: "gpt-5.6-terra",
    usage: emptyUsage,
    stopReason: args.stopReason,
    timestamp: args.timestamp,
  };
}
