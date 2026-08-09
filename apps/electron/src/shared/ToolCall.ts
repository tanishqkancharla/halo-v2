/**
 * Compact tool-call lines shown in the assistant feed (Maui AiChat pattern).
 * Built from Pi coding tools: read, write, edit, bash.
 */
export type ToolCall =
  | { id: string; kind: "read"; path: string }
  | { id: string; kind: "wrote"; path: string }
  | { id: string; kind: "shell"; command: string };

/** Map a Pi tool invocation to a feed line, or null when the tool is unknown. */
export function toolCallFromPi(
  id: string,
  toolName: string,
  args: unknown,
): ToolCall | null {
  if (typeof args !== "object" || args === null) return null;

  if (toolName === "read") {
    if (!("path" in args) || typeof args.path !== "string") return null;
    return { id, kind: "read", path: args.path };
  }

  if (toolName === "write" || toolName === "edit") {
    if (!("path" in args) || typeof args.path !== "string") return null;
    return { id, kind: "wrote", path: args.path };
  }

  if (toolName === "bash") {
    if (!("command" in args) || typeof args.command !== "string") return null;
    return { id, kind: "shell", command: args.command };
  }

  return null;
}

/** Pull toolCall content blocks from an assistant message into feed lines. */
export function collectToolCalls(content: unknown): ToolCall[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((part) => {
    if (typeof part !== "object" || part === null) return [];
    if (!("type" in part) || part.type !== "toolCall") return [];
    if (!("id" in part) || typeof part.id !== "string") return [];
    if (!("name" in part) || typeof part.name !== "string") return [];
    if (!("arguments" in part)) return [];
    const mapped = toolCallFromPi(part.id, part.name, part.arguments);
    if (mapped === null) return [];
    return [mapped];
  });
}
