import type { AgentMessage } from "../../shared/rpc.js";
import { toolCallFromPi } from "../../shared/ToolCall.js";
import type { AgentSessionState, ToolExecution } from "./AgentSessionState.ts";

export type SessionFeedItem =
  | { kind: "user"; id: string; text: string }
  | {
      kind: "assistantTurn";
      id: string;
      parts: SessionFeedPart[];
    };

export type SessionFeedPart =
  | { kind: "text"; id: string; text: string; streaming: boolean }
  | { kind: "tool"; tool: ToolExecution };

/**
 * Project AgentSessionState into feed rows: one user bubble per user message,
 * one assistant column per stretch of assistant/tool activity (Pi TUI shape).
 */
export function sessionFeedItems(state: AgentSessionState): SessionFeedItem[] {
  const items: SessionFeedItem[] = [];
  let assistantParts: SessionFeedPart[] = [];
  let assistantId = "assistant";
  const emittedTools = new Set<string>();

  function flushAssistant() {
    if (assistantParts.length === 0) return;
    items.push({
      kind: "assistantTurn",
      id: assistantId,
      parts: assistantParts,
    });
    assistantParts = [];
  }

  function pushTool(tool: ToolExecution) {
    if (emittedTools.has(tool.toolCallId)) return;
    emittedTools.add(tool.toolCallId);
    assistantParts.push({ kind: "tool", tool });
  }

  function pushAssistantMessage(message: AgentMessage, streaming: boolean) {
    if (message.role !== "assistant") return;
    assistantId = `assistant-${message.timestamp}`;
    const text = assistantText(message);
    if (text.length > 0) {
      assistantParts.push({
        kind: "text",
        id: `text-${message.timestamp}`,
        text,
        streaming,
      });
    }
    for (const part of message.content) {
      if (part.type !== "toolCall") continue;
      const tool = state.tools[part.id];
      if (tool === undefined) {
        pushTool({
          toolCallId: part.id,
          toolName: part.name,
          args: part.arguments,
          isError: false,
          isPartial: streaming,
        });
        continue;
      }
      pushTool(tool);
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
      continue;
    }
    // toolResult rows are folded into tool parts via state.tools
  }

  if (state.streamingMessage !== null) {
    pushAssistantMessage(state.streamingMessage, true);
  }

  for (const tool of Object.values(state.tools)) {
    pushTool(tool);
  }

  flushAssistant();
  return items;
}

export function toolExecutionLabel(tool: ToolExecution): {
  kind: "read" | "wrote" | "shell" | "other";
  text: string;
} {
  const mapped = toolCallFromPi(tool.toolCallId, tool.toolName, tool.args);
  if (mapped === null) {
    return { kind: "other", text: tool.toolName };
  }
  if (mapped.kind === "read") return { kind: "read", text: mapped.path };
  if (mapped.kind === "wrote") return { kind: "wrote", text: mapped.path };
  return { kind: "shell", text: mapped.command };
}

function userText(message: AgentMessage): string {
  if (message.role !== "user") return "";
  if (typeof message.content === "string") return message.content;
  return message.content
    .flatMap((part) => {
      if (part.type !== "text") return [];
      return [part.text];
    })
    .join("");
}

function assistantText(message: AgentMessage): string {
  if (message.role !== "assistant") return "";
  return message.content
    .flatMap((part) => {
      if (part.type !== "text") return [];
      return [part.text];
    })
    .join("");
}
