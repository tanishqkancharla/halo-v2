import * as errore from "errore";
import type { AgentMessage, AgentSessionEvent } from "./rpc.js";

/**
 * Client projection of a Pi AgentSession.
 * Durable load sets messages only; streaming fills streamingMessage via events.
 */
export type AgentSessionState = {
  messages: AgentMessage[];
  streamingMessage: AgentMessage | null;
  error: string | null;
};

export function emptyAgentSessionState(): AgentSessionState {
  return {
    messages: [],
    streamingMessage: null,
    error: null,
  };
}

/** Build feed state from a live Pi session's loaded messages. */
export function agentSessionStateFromSession(session: {
  messages: AgentMessage[];
}): AgentSessionState {
  return {
    messages: session.messages,
    streamingMessage: null,
    error: errorFromLastAssistantMessage(session.messages),
  };
}

export function applyAgentSessionEvent(
  state: AgentSessionState,
  event: AgentSessionEvent,
): AgentSessionState {
  switch (event.type) {
    case "message_start":
      if (event.message.role === "user") {
        return {
          ...state,
          messages: [...state.messages, event.message],
          error: null,
        };
      }
      if (event.message.role === "assistant") {
        return {
          ...state,
          streamingMessage: event.message,
          error: null,
        };
      }
      return state;

    case "message_update":
      if (event.message.role !== "assistant") return state;
      return {
        ...state,
        streamingMessage: event.message,
      };

    case "message_end":
      if (event.message.role === "user") return state;
      if (event.message.role === "assistant") {
        const error = assistantTurnError(event.message);
        if (error === null) {
          return {
            ...state,
            messages: [...state.messages, event.message],
            streamingMessage: null,
          };
        }
        return {
          ...state,
          messages: [...state.messages, event.message],
          streamingMessage: null,
          error,
        };
      }
      if (event.message.role === "toolResult") {
        return {
          ...state,
          messages: [...state.messages, event.message],
        };
      }
      return state;

    default:
      return state;
  }
}

function errorFromLastAssistantMessage(
  messages: AgentMessage[],
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message === undefined) continue;
    if (message.role !== "assistant") continue;
    return assistantTurnError(message);
  }
  return null;
}

/** Readable alert text when an assistant turn failed; otherwise null. */
function assistantTurnError(message: AgentMessage): string | null {
  if (message.role !== "assistant") return null;

  const errorMessage = message.errorMessage;
  const hasErrorMessage =
    errorMessage !== undefined && errorMessage.length > 0;
  if (message.stopReason !== "error" && !hasErrorMessage) return null;
  if (!hasErrorMessage) return null;

  return readableAgentErrorMessage(errorMessage);
}

class AgentErrorMessageParseError extends errore.createTaggedError({
  name: "AgentErrorMessageParseError",
  message: "Assistant errorMessage was not valid JSON",
}) {}

function readableAgentErrorMessage(errorMessage: string): string {
  const trimmed = errorMessage.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return errorMessage;
  }

  const parsed = errore.try({
    try: () => JSON.parse(trimmed) as unknown,
    catch: (e) => new AgentErrorMessageParseError({ cause: e }),
  });
  if (parsed instanceof Error) {
    console.warn("Assistant errorMessage looked like JSON but failed to parse");
    return errorMessage;
  }

  const extracted = humanMessageFromJson(parsed);
  if (extracted === null) return errorMessage;
  return extracted;
}

function humanMessageFromJson(value: unknown): string | null {
  if (typeof value === "string") {
    const nested = errore.try({
      try: () => JSON.parse(value) as unknown,
      catch: (e) => new AgentErrorMessageParseError({ cause: e }),
    });
    if (nested instanceof Error) {
      if (value.length === 0) return null;
      return value;
    }
    return humanMessageFromJson(nested);
  }

  if (typeof value !== "object" || value === null) return null;

  if ("error" in value) {
    const error = value.error;
    if (typeof error === "string") {
      if (error.length === 0) return null;
      return error;
    }
    if (typeof error === "object" && error !== null && "message" in error) {
      if (typeof error.message === "string" && error.message.length > 0) {
        return error.message;
      }
    }
  }

  if ("message" in value && typeof value.message === "string") {
    if (value.message.length === 0) return null;
    return value.message;
  }

  return null;
}
