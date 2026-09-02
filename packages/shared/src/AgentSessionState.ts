import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import type { AgentMessage, AgentSessionEvent } from "./rpc.js";

/**
 * Client projection of a Pi AgentSession.
 * Durable load sets messages only; streaming fills streamingMessage via events.
 */
export type AgentSessionState = {
  messages: AgentMessage[];
  streamingMessage: AgentMessage | undefined;
  error: string | undefined;
  isWorking: boolean;
};

export function emptyAgentSessionState(): AgentSessionState {
  return {
    messages: [],
    streamingMessage: undefined,
    error: undefined,
    isWorking: false,
  };
}

/** Build feed state from a live Pi session's loaded messages. */
export function agentSessionStateFromSession(session: {
  messages: AgentMessage[];
  isStreaming: boolean;
}): AgentSessionState {
  if (session.isStreaming) {
    const messages = session.messages.slice();
    const last = messages.at(-1);
    if (last !== undefined && last.role === "assistant") {
      messages.pop();
      return {
        messages,
        streamingMessage: last,
        error: undefined,
        isWorking: true,
      };
    }
    return {
      messages,
      streamingMessage: undefined,
      error: undefined,
      isWorking: true,
    };
  }
  return {
    messages: session.messages,
    streamingMessage: undefined,
    error: errorFromLastAssistantMessage(session.messages),
    isWorking: false,
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
          error: undefined,
        };
      }
      if (event.message.role === "assistant") {
        return {
          ...state,
          streamingMessage: event.message,
          error: undefined,
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
        if (error === undefined) {
          return {
            ...state,
            messages: [...state.messages, event.message],
            streamingMessage: undefined,
          };
        }
        return {
          ...state,
          messages: [...state.messages, event.message],
          streamingMessage: undefined,
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

    case "agent_start":
      return { ...state, isWorking: true };

    case "agent_end":
      return { ...state, isWorking: false };

    default:
      return state;
  }
}

function errorFromLastAssistantMessage(
  messages: AgentMessage[],
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message === undefined) continue;
    if (message.role !== "assistant") continue;
    return assistantTurnError(message);
  }
  return undefined;
}

/** True when the latest user turn ended in a user abort. */
export function lastAssistantTurnWasAborted(messages: AgentMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message === undefined) continue;
    if (message.role === "toolResult") continue;
    if (message.role === "user") return false;
    if (message.role === "assistant") return message.stopReason === "aborted";
  }
  return false;
}

/** Readable alert text when an assistant turn failed. */
function assistantTurnError(message: AgentMessage): string | undefined {
  if (message.role !== "assistant") return undefined;
  if (message.stopReason === "aborted") return undefined;

  const errorMessage = message.errorMessage;
  const hasErrorMessage = errorMessage !== undefined && errorMessage.length > 0;
  if (message.stopReason !== "error" && !hasErrorMessage) return undefined;
  if (!hasErrorMessage) return undefined;

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
    try: () => {
      // SAFETY: JSON.parse is untyped; humanMessageFromJson decodes the payload.
      return JSON.parse(trimmed) as unknown;
    },
    catch: (e) => new AgentErrorMessageParseError({ cause: e }),
  });
  if (parsed instanceof Error) {
    console.warn("Assistant errorMessage looked like JSON but failed to parse");
    return errorMessage;
  }

  const extracted = humanMessageFromJson({ value: parsed });
  if (extracted === undefined) return errorMessage;
  return extracted;
}

const agentErrorJsonSchema = Type.Object({
  error: Type.Optional(
    Type.Union([
      Type.String(),
      Type.Object({
        message: Type.String(),
      }),
    ]),
  ),
  message: Type.Optional(Type.String()),
});

function humanMessageFromJson(args: { value: unknown }): string | undefined {
  if (Value.Check(Type.String(), args.value)) {
    const value = args.value;
    const nested = errore.try({
      try: () => {
        // SAFETY: JSON.parse is untyped; nested error JSON is decoded by this function.
        return JSON.parse(value) as unknown;
      },
      catch: (e) => new AgentErrorMessageParseError({ cause: e }),
    });
    if (nested instanceof Error) {
      if (value.length === 0) return undefined;
      return value;
    }
    return humanMessageFromJson({ value: nested });
  }

  if (!Value.Check(agentErrorJsonSchema, args.value)) return undefined;

  const error = args.value.error;
  if (Value.Check(Type.String(), error)) {
    if (error.length === 0) return undefined;
    return error;
  }
  if (
    Value.Check(Type.Object({ message: Type.String({ minLength: 1 }) }), error)
  ) {
    return error.message;
  }

  const message = args.value.message;
  if (message === undefined || message.length === 0) return undefined;
  return message;
}
