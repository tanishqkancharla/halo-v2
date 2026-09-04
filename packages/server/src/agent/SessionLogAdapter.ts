import { randomUUID } from "node:crypto";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import {
  projectSession,
  type SessionLogEvent,
} from "@get-halo/shared/sessionLog";

export type PiEventAdapterState = {
  activeRunId: string | undefined;
};

type AdaptedPiEvent = {
  state: PiEventAdapterState;
  events: SessionLogEvent[];
};

export function adaptPiEvent(args: {
  state: PiEventAdapterState;
  event: AgentSessionEvent;
}): AdaptedPiEvent {
  if (args.event.type === "agent_start") {
    const runId = randomUUID();
    return {
      state: { activeRunId: runId },
      events: [{ type: "run.started", runId }],
    };
  }

  if (args.event.type === "agent_end") {
    const runId = args.state.activeRunId;
    if (runId === undefined) return { state: args.state, events: [] };
    return {
      state: { activeRunId: undefined },
      events: [{ type: "run.finished", runId, outcome: "completed" }],
    };
  }

  if (args.event.type === "message_end") {
    return {
      state: args.state,
      events: [{ type: "message.committed", message: args.event.message }],
    };
  }

  if (args.event.type === "message_update") {
    const runId = args.state.activeRunId;
    if (runId === undefined) return { state: args.state, events: [] };
    return {
      state: args.state,
      events: [
        {
          type: "assistant.updated",
          runId,
          update: args.event.assistantMessageEvent,
        },
      ],
    };
  }

  if (args.event.type === "tool_execution_start") {
    const runId = args.state.activeRunId;
    if (runId === undefined) return { state: args.state, events: [] };
    return {
      state: args.state,
      events: [
        {
          type: "tool.started",
          invocation: {
            id: args.event.toolCallId,
            runId,
            tool: {
              path: args.event.toolName,
              displayName: displayName(args.event.toolName),
            },
            arguments: args.event.args,
          },
        },
      ],
    };
  }

  if (args.event.type === "tool_execution_update") {
    return {
      state: args.state,
      events: [
        {
          type: "tool.updated",
          invocationId: args.event.toolCallId,
          update: args.event.partialResult,
        },
      ],
    };
  }

  if (args.event.type === "tool_execution_end") {
    return {
      state: args.state,
      events: [
        {
          type: "tool.finished",
          invocationId: args.event.toolCallId,
          result: args.event.result,
          isError: args.event.isError,
        },
      ],
    };
  }

  return { state: args.state, events: [] };
}

export function interruptedSessionEvents(
  events: readonly SessionLogEvent[],
): SessionLogEvent[] {
  const projected = projectSession(events);
  const runId = projected.activeRunId;
  if (runId === undefined) return [];

  const interruptedTools: SessionLogEvent[] = projected.activeInvocations.map(
    ({ invocation }) => ({
      type: "tool.finished",
      invocationId: invocation.id,
      result: {
        content: [{ type: "text", text: "Interrupted when Halo restarted." }],
        details: { interrupted: true },
      },
      isError: true,
    }),
  );
  return [
    ...interruptedTools,
    { type: "run.finished", runId, outcome: "interrupted" },
  ];
}

function displayName(toolName: string): string {
  return toolName
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
