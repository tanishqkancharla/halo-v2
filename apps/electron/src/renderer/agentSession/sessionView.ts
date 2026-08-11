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
      assistantParts.push({
        kind: "tool",
        id: part.id,
        toolName: part.name,
        args: part.arguments,
        ...(resultText === undefined ? {} : { resultText }),
      });
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

  if (state.streamingMessage !== null) {
    pushAssistantMessage(state.streamingMessage, true);
  }

  flushAssistant();
  return items;
}

/** Maui AiChat labels for Pi coding tools. */
export function toolPartLabel(part: { toolName: string; args: unknown }): {
  kind: "read" | "wrote" | "shell" | "other";
  text: string;
} {
  const args = part.args;
  if (typeof args !== "object" || args === null) {
    return { kind: "other", text: part.toolName };
  }

  if (part.toolName === "read") {
    if (!("path" in args) || typeof args.path !== "string") {
      return { kind: "other", text: part.toolName };
    }
    return { kind: "read", text: args.path };
  }

  if (part.toolName === "write" || part.toolName === "edit") {
    if (!("path" in args) || typeof args.path !== "string") {
      return { kind: "other", text: part.toolName };
    }
    return { kind: "wrote", text: args.path };
  }

  if (part.toolName === "bash") {
    if (!("command" in args) || typeof args.command !== "string") {
      return { kind: "other", text: part.toolName };
    }
    return { kind: "shell", text: args.command };
  }

  return { kind: "other", text: part.toolName };
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
  if (typeof message.content === "string") return message.content;
  return message.content
    .flatMap((part) => {
      if (part.type !== "text") return [];
      return [part.text];
    })
    .join("");
}
