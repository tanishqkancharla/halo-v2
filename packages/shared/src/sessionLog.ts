import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import type { AgentToolResult } from "@earendil-works/pi-coding-agent";
import type { AgentSessionState } from "./AgentSessionState.js";
import type { HaloConnectionEvent } from "./contract.js";
import type { AgentMessage, AgentSessionEvent } from "./rpc.js";

type AssistantMessageUpdate = Extract<
  AgentSessionEvent,
  { type: "message_update" }
>["assistantMessageEvent"];

export type ToolIdentity = {
  path: string;
  displayName: string;
  integrationId?: string;
};

export type ToolInvocation = {
  id: string;
  runId: string;
  parentId?: string;
  tool: ToolIdentity;
  arguments: unknown;
};

export type SessionLogEvent =
  | { type: "run.started"; runId: string }
  | { type: "run.finished"; runId: string }
  | { type: "message.committed"; message: AgentMessage }
  | {
      type: "assistant.updated";
      runId: string;
      update: AssistantMessageUpdate;
    }
  | { type: "tool.started"; invocation: ToolInvocation }
  | { type: "tool.updated"; invocationId: string; update: unknown }
  | {
      type: "tool.finished";
      invocationId: string;
      result: AgentToolResult<unknown>;
      isError: boolean;
    }
  | { type: "session.error"; message: string | undefined }
  | HaloConnectionEvent;

export type ActiveToolInvocation = {
  invocation: ToolInvocation;
  update?: unknown;
};

export type ProjectedSession = {
  messages: AgentMessage[];
  streamingMessage: AgentMessage | undefined;
  activeInvocations: ActiveToolInvocation[];
  connectionEvents: HaloConnectionEvent[];
  error: string | undefined;
  isWorking: boolean;
};

export function projectSession(
  events: readonly SessionLogEvent[],
): ProjectedSession {
  const messages: AgentMessage[] = [];
  const activeInvocations = new Map<string, ActiveToolInvocation>();
  const connectionEvents: HaloConnectionEvent[] = [];
  let streamingMessage: AgentMessage | undefined;
  let error: string | undefined;
  let activeRunId: string | undefined;

  for (const event of events) {
    switch (event.type) {
      case "run.started":
        if (activeRunId !== undefined && activeRunId !== event.runId) {
          for (const [id, active] of activeInvocations) {
            if (active.invocation.runId === activeRunId) {
              activeInvocations.delete(id);
            }
          }
        }
        activeRunId = event.runId;
        break;
      case "run.finished":
        if (event.runId === activeRunId) activeRunId = undefined;
        for (const [id, active] of activeInvocations) {
          if (active.invocation.runId === event.runId) {
            activeInvocations.delete(id);
          }
        }
        break;
      case "message.committed": {
        messages.push(event.message);
        if (event.message.role === "user") error = undefined;
        if (event.message.role !== "assistant") break;
        streamingMessage = undefined;
        const turnError = assistantTurnError(event.message);
        if (turnError !== undefined) error = turnError;
        break;
      }
      case "assistant.updated":
        streamingMessage = assistantMessageFromUpdate(event.update);
        error = undefined;
        break;
      case "tool.started":
        activeInvocations.set(event.invocation.id, {
          invocation: event.invocation,
        });
        break;
      case "tool.updated": {
        const active = activeInvocations.get(event.invocationId);
        if (active === undefined) break;
        activeInvocations.set(event.invocationId, {
          invocation: active.invocation,
          update: event.update,
        });
        break;
      }
      case "tool.finished":
        activeInvocations.delete(event.invocationId);
        break;
      case "session.error":
        error = event.message;
        break;
      case "halo.connection":
        connectionEvents.push(event);
        break;
    }
  }

  return {
    messages,
    streamingMessage,
    activeInvocations: [...activeInvocations.values()],
    connectionEvents,
    error,
    isWorking: activeRunId !== undefined,
  };
}

const legacyRunId = "legacy-run";

export function legacyStateToSessionLog(
  state: AgentSessionState,
): SessionLogEvent[] {
  const events: SessionLogEvent[] = state.messages.map((message) => ({
    type: "message.committed",
    message,
  }));
  if (state.isWorking) events.push({ type: "run.started", runId: legacyRunId });
  if (state.streamingMessage?.role === "assistant") {
    events.push({
      type: "assistant.updated",
      runId: legacyRunId,
      update: { type: "start", partial: state.streamingMessage },
    });
  }
  events.push({ type: "session.error", message: state.error });
  return events;
}

function assistantMessageFromUpdate(
  update: AssistantMessageUpdate,
): AgentMessage {
  if (update.type === "done") return update.message;
  if (update.type === "error") return update.error;
  return update.partial;
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
export function assistantTurnError(message: AgentMessage): string | undefined {
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
