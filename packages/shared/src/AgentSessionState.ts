import type { AgentMessage, AgentSessionEvent } from "./rpc.js";
import { assistantTurnError } from "./sessionLog.js";

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
