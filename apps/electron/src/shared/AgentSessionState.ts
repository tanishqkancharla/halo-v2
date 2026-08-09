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

/** Build state from a durable session snapshot (readSession). */
export function agentSessionStateFromSession(session: {
  messages: AgentMessage[];
}): AgentSessionState {
  return {
    messages: session.messages,
    streamingMessage: null,
    error: null,
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
        return {
          ...state,
          messages: [...state.messages, event.message],
          streamingMessage: null,
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
