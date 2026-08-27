import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { AgentMessage } from "../../shared/rpc.js";
import type { AgentSessionState } from "../../shared/AgentSessionState.js";
import {
  connectionRequestSchema,
  type ConnectionRequest,
} from "../../shared/connectionRequests.js";

export type SessionViewItem =
  | { kind: "user"; id: string; text: string }
  | {
      kind: "assistantTurn";
      id: string;
      parts: SessionViewPart[];
    };

export type SessionViewPart =
  | { kind: "text"; id: string; text: string; streaming: boolean }
  | {
      kind: "tool";
      id: string;
      toolName: string;
      args: ToolArgs;
      resultText?: string;
    }
  | {
      kind: "executorConnection";
      id: string;
      request: ConnectionRequest;
    };

/** Tool call arguments as parsed from JSON — values may be any JSON-representable scalar or composite. */
type ToolArgValue =
  | string
  | number
  | boolean
  | ToolArgValue[]
  | { [K in string]: ToolArgValue };
type ToolArgs = { [K in string]: ToolArgValue };

type ToolPartLabel = {
  kind: "read" | "wrote" | "shell" | "exec" | "other";
  text: string;
};

const connectionDetailsSchema = Type.Object({
  connectionRequests: Type.Array(connectionRequestSchema),
});

const pathArgsSchema = Type.Object({
  path: Type.String(),
});

const bashArgsSchema = Type.Object({
  command: Type.String(),
});

/**
 * Project AgentSessionState into view rows: one user bubble per user message,
 * one assistant column per stretch of assistant activity (Pi TUI shape).
 * Tool lines come from assistant message toolCall content blocks.
 */
export function sessionViewItems(state: AgentSessionState): SessionViewItem[] {
  const items: SessionViewItem[] = [];
  let assistantParts: SessionViewPart[] = [];
  let assistantId = "assistant";
  const emittedTools = new Set<string>();
  const toolResults = toolResultsByCallId(state);

  function flushAssistant() {
    if (assistantParts.length === 0) return;
    items.push({
      kind: "assistantTurn",
      id: assistantId,
      parts: assistantParts,
    });
    assistantParts = [];
  }

  function pushAssistantMessage(message: AgentMessage, streaming: boolean) {
    if (message.role !== "assistant") return;
    assistantId = `assistant-${message.timestamp}`;
    let textIndex = 0;
    for (const part of message.content) {
      if (part.type === "text") {
        if (part.text.length === 0) continue;
        assistantParts.push({
          kind: "text",
          id: `text-${message.timestamp}-${textIndex}`,
          text: part.text,
          streaming,
        });
        textIndex += 1;
        continue;
      }
      if (part.type !== "toolCall") continue;
      if (emittedTools.has(part.id)) continue;
      emittedTools.add(part.id);
      const toolResult = toolResults.get(part.id);
      const resultText = toolResult?.text;
      if (part.name === "exec" && toolResult !== undefined) {
        for (const [
          index,
          request,
        ] of toolResult.connectionRequests.entries()) {
          assistantParts.push({
            kind: "executorConnection",
            id: `${part.id}-connection-${index}`,
            request,
          });
        }
        if (toolResult.connectionRequests.length > 0) continue;
      }
      const toolPart: Extract<SessionViewPart, { kind: "tool" }> = {
        kind: "tool",
        id: part.id,
        toolName: part.name,
        args: part.arguments,
      };
      if (resultText !== undefined) {
        toolPart.resultText = resultText;
      }
      assistantParts.push(toolPart);
    }
  }

  for (const message of state.messages) {
    if (message.role === "user") {
      flushAssistant();
      items.push({
        kind: "user",
        id: `user-${message.timestamp}`,
        text: userText(message),
      });
      continue;
    }
    if (message.role === "assistant") {
      pushAssistantMessage(message, false);
      if (message.stopReason !== "toolUse") flushAssistant();
    }
  }

  if (state.streamingMessage !== undefined) {
    pushAssistantMessage(state.streamingMessage, true);
  }

  flushAssistant();
  return items;
}

/** Maui AiChat labels for Pi coding tools. */
export function toolPartLabel(
  part: {
    toolName: string;
    args: unknown;
  },
  workspaceRoot: string | undefined,
): ToolPartLabel {
  if (part.toolName === "exec") {
    return { kind: "exec", text: "Exec" };
  }

  if (part.toolName === "read") {
    if (!Value.Check(pathArgsSchema, part.args)) {
      return { kind: "other", text: part.toolName };
    }
    return {
      kind: "read",
      text: stripWorkspaceRootPrefix(part.args.path, workspaceRoot),
    };
  }

  if (part.toolName === "write" || part.toolName === "edit") {
    if (!Value.Check(pathArgsSchema, part.args)) {
      return { kind: "other", text: part.toolName };
    }
    return {
      kind: "wrote",
      text: stripWorkspaceRootPrefix(part.args.path, workspaceRoot),
    };
  }

  if (part.toolName === "bash") {
    if (!Value.Check(bashArgsSchema, part.args)) {
      return { kind: "other", text: part.toolName };
    }
    return { kind: "shell", text: part.args.command };
  }

  return { kind: "other", text: part.toolName };
}

const execArgsSchema = Type.Object({ js: Type.String() });

export function execJsSource(args: ToolArgs): string | undefined {
  if (!Value.Check(execArgsSchema, args)) return undefined;
  return args.js;
}

function stripWorkspaceRootPrefix(
  filePath: string,
  workspaceRoot: string | undefined,
): string {
  if (workspaceRoot === undefined) return filePath;
  const root = toPosixPath(workspaceRoot).replace(/\/+$/, "");
  const posix = toPosixPath(filePath);
  if (posix === root) return ".";
  if (!posix.startsWith(`${root}/`)) return filePath;
  const relative = posix.slice(root.length + 1);
  if (relative.length === 0) return ".";
  return relative;
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function toolResultsByCallId(state: AgentSessionState) {
  const map = new Map<
    string,
    { text: string; connectionRequests: ConnectionRequest[] }
  >();
  for (const message of state.messages) {
    if (message.role !== "toolResult") continue;
    const connectionRequests = Value.Check(
      connectionDetailsSchema,
      message.details,
    )
      ? message.details.connectionRequests
      : [];
    map.set(message.toolCallId, {
      text: toolResultText(message),
      connectionRequests,
    });
  }
  return map;
}

function toolResultText(message: AgentMessage): string {
  if (message.role !== "toolResult") return "";
  return message.content
    .flatMap((part) => {
      if (part.type !== "text") return [];
      return [part.text];
    })
    .join("");
}

function userText(message: AgentMessage): string {
  if (message.role !== "user") return "";
  if (Array.isArray(message.content)) {
    return message.content
      .flatMap((part) => {
        if (part.type !== "text") return [];
        return [part.text];
      })
      .join("");
  }
  return message.content;
}
