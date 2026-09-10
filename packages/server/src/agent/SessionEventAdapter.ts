import type { HarnessEvent } from "@earendil-works/pi-agent-core";
import { Value } from "@sinclair/typebox/value";
import {
  directToolIdentity,
  execActivityUpdateSchema,
  type SessionEvent,
} from "@get-halo/shared/sessionState";

export function adaptPiEvent(event: HarnessEvent): SessionEvent[] {
  switch (event.type) {
    case "fault":
      return [{ type: "session.failed", error: event.message }];
    case "run_start":
      return [{ type: "run.started", runId: event.runId }];
    case "run_end":
      return [
        {
          type: "run.finished",
          runId: event.runId,
          outcome: event.status,
          error: event.error?.message,
        },
      ];
    case "entry_added":
      return event.entry.type === "message"
        ? [{ type: "message.committed", message: event.entry.message }]
        : [];
    case "message_update":
      return [
        { type: "assistant.updated", runId: event.runId, update: event.event },
      ];
    case "tool_start":
      return [
        {
          type: "tool.started",
          invocation: {
            id: event.toolCallId,
            runId: event.runId,
            tool: directToolIdentity(event.toolName),
            arguments: event.args,
          },
        },
      ];
    case "tool_update": {
      const update = event.partialResult.details;
      if (
        event.toolName === "exec" &&
        Value.Check(execActivityUpdateSchema, update)
      ) {
        if (update.type === "tool.started")
          return [
            {
              type: "tool.started",
              invocation: { ...update.invocation, runId: event.runId },
            },
          ];
        return [
          {
            type: "tool.finished",
            invocationId: update.invocationId,
            result: { content: [] },
            isError: update.isError,
          },
        ];
      }
      return [
        {
          type: "tool.updated",
          invocationId: event.toolCallId,
          update: event.partialResult,
        },
      ];
    }
    case "tool_end":
      return [
        {
          type: "tool.finished",
          invocationId: event.toolCallId,
          result: event.result,
          isError: event.isError,
        },
      ];
    default:
      return [];
  }
}
