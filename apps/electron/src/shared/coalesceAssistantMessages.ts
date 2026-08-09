import type { SessionMessage } from "./rpc.js";

/**
 * Join consecutive assistant messages into one feed row.
 *
 * Agent stores often keep one assistant message per model round (tool call,
 * then later text). Live streaming usually accumulates one assistant turn.
 * Chat UIs commonly join at the view/converter boundary — e.g. assistant-ui's
 * default `joinStrategy: "concat-content"`, and AI SDK `UIMessage.parts`.
 */
export function coalesceAssistantMessages(
  messages: SessionMessage[],
): SessionMessage[] {
  const coalesced: SessionMessage[] = [];
  for (const message of messages) {
    const previous = coalesced[coalesced.length - 1];
    if (
      previous !== undefined &&
      previous.role === "assistant" &&
      message.role === "assistant"
    ) {
      coalesced[coalesced.length - 1] = {
        id: previous.id,
        role: "assistant",
        text: joinAssistantText(previous.text, message.text),
        toolCalls: [...previous.toolCalls, ...message.toolCalls],
        timestamp: previous.timestamp,
      };
      continue;
    }
    coalesced.push(message);
  }
  return coalesced;
}

function joinAssistantText(left: string, right: string): string {
  if (left.length === 0) return right;
  if (right.length === 0) return left;
  return `${left}\n\n${right}`;
}
