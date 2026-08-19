import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { AgentMessage } from "../../shared/rpc.js";
import type { AgentSessionState } from "../../shared/AgentSessionState.js";

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
      args: unknown;
      resultText?: string;
    };

export type ToolPartLabel = {
  kind: "read" | "wrote" | "shell" | "other";
  text: string;
};

const pathArgsSchema = Type.Object({
  path: Type.String(),
});

const bashArgsSchema = Type.Object({
  command: Type.String(),
});

const webSearchArgsSchema = Type.Object({
  objective: Type.String(),
});

const webFetchArgsSchema = Type.Object({
  urls: Type.Array(Type.String()),
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
      const resultText = toolResults.get(part.id);
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

  if (part.toolName === "web_search") {
    if (!Value.Check(webSearchArgsSchema, part.args)) {
      return { kind: "other", text: part.toolName };
    }
    return { kind: "other", text: `Search ${part.args.objective}` };
  }

  if (part.toolName === "web_fetch") {
    if (!Value.Check(webFetchArgsSchema, part.args)) {
      return { kind: "other", text: part.toolName };
    }
    const url = part.args.urls[0];
    if (url === undefined) {
      return { kind: "other", text: part.toolName };
    }
    return { kind: "other", text: `Fetch ${url}` };
  }

  return { kind: "other", text: part.toolName };
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

function toolResultsByCallId(state: AgentSessionState): Map<string, string> {
  const map = new Map<string, string>();
  for (const message of state.messages) {
    if (message.role !== "toolResult") continue;
    map.set(message.toolCallId, toolResultText(message));
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
