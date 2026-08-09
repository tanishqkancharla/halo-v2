import type { AgentMessage, AgentSessionEvent } from "../../shared/rpc.js";

export type ToolExecution = {
  toolCallId: string;
  toolName: string;
  args: unknown | null;
  result?: unknown;
  isError: boolean;
  isPartial: boolean;
};

/**
 * Client-side projection of a Pi AgentSession for the feed.
 * Messages are Pi AgentMessages; tools mirror Pi's ToolExecutionComponent map.
 */
export type AgentSessionState = {
  messages: AgentMessage[];
  streamingMessage: AgentMessage | null;
  tools: Record<string, ToolExecution>;
  error: string | null;
};

export function emptyAgentSessionState(): AgentSessionState {
  return {
    messages: [],
    streamingMessage: null,
    tools: {},
    error: null,
  };
}

export function agentSessionStateFromMessages(
  messages: AgentMessage[],
): AgentSessionState {
  return {
    messages,
    streamingMessage: null,
    tools: toolsFromMessages(messages),
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
        tools: ensureToolsFromAssistant(state.tools, event.message, true),
      };

    case "message_end":
      if (event.message.role === "user") return state;
      if (event.message.role === "assistant") {
        return {
          ...state,
          messages: [...state.messages, event.message],
          streamingMessage: null,
          tools: ensureToolsFromAssistant(state.tools, event.message, true),
        };
      }
      if (event.message.role === "toolResult") {
        const prior = state.tools[event.message.toolCallId];
        return {
          ...state,
          messages: [...state.messages, event.message],
          tools: {
            ...state.tools,
            [event.message.toolCallId]: {
              toolCallId: event.message.toolCallId,
              toolName: event.message.toolName,
              args: prior === undefined ? null : prior.args,
              result: event.message,
              isError: event.message.isError,
              isPartial: false,
            },
          },
        };
      }
      return state;

    case "tool_execution_start":
      return {
        ...state,
        tools: {
          ...state.tools,
          [event.toolCallId]: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            isError: false,
            isPartial: true,
          },
        },
      };

    case "tool_execution_update":
      return {
        ...state,
        tools: {
          ...state.tools,
          [event.toolCallId]: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            result: event.partialResult,
            isError: false,
            isPartial: true,
          },
        },
      };

    case "tool_execution_end": {
      const prior = state.tools[event.toolCallId];
      return {
        ...state,
        tools: {
          ...state.tools,
          [event.toolCallId]: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: prior === undefined ? null : prior.args,
            result: event.result,
            isError: event.isError,
            isPartial: false,
          },
        },
      };
    }

    default:
      return state;
  }
}

function ensureToolsFromAssistant(
  tools: Record<string, ToolExecution>,
  message: AgentMessage,
  isPartial: boolean,
): Record<string, ToolExecution> {
  if (message.role !== "assistant") return tools;
  let next = tools;
  for (const part of message.content) {
    if (part.type !== "toolCall") continue;
    if (next[part.id] !== undefined) continue;
    if (next === tools) next = { ...tools };
    next[part.id] = {
      toolCallId: part.id,
      toolName: part.name,
      args: part.arguments,
      isError: false,
      isPartial,
    };
  }
  return next;
}

function toolsFromMessages(
  messages: AgentMessage[],
): Record<string, ToolExecution> {
  let tools: Record<string, ToolExecution> = {};
  for (const message of messages) {
    if (message.role === "assistant") {
      tools = ensureToolsFromAssistant(tools, message, false);
    }
    if (message.role === "toolResult") {
      const prior = tools[message.toolCallId];
      tools = {
        ...tools,
        [message.toolCallId]: {
          toolCallId: message.toolCallId,
          toolName: message.toolName,
          args: prior === undefined ? null : prior.args,
          result: message,
          isError: message.isError,
          isPartial: false,
        },
      };
    }
  }
  return tools;
}
