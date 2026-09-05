import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import { connectionRequestSchema } from "./connectionRequests.js";

const textContentSchema = Type.Object({
  type: Type.Literal("text"),
  text: Type.String(),
  textSignature: Type.Optional(Type.String()),
});

const imageContentSchema = Type.Object({
  type: Type.Literal("image"),
  data: Type.String(),
  mimeType: Type.String(),
});

const thinkingContentSchema = Type.Object({
  type: Type.Literal("thinking"),
  thinking: Type.String(),
  thinkingSignature: Type.Optional(Type.String()),
  redacted: Type.Optional(Type.Boolean()),
});

const jsonValueSchema = Type.Recursive((value) =>
  Type.Union([
    Type.String(),
    Type.Number(),
    Type.Boolean(),
    Type.Null(),
    Type.Array(value),
    Type.Record(Type.String(), value),
  ]),
);

const toolCallSchema = Type.Object({
  type: Type.Literal("toolCall"),
  id: Type.String(),
  name: Type.String(),
  arguments: Type.Record(Type.String(), jsonValueSchema),
  thoughtSignature: Type.Optional(Type.String()),
});

const usageSchema = Type.Object({
  input: Type.Number(),
  output: Type.Number(),
  cacheRead: Type.Number(),
  cacheWrite: Type.Number(),
  cacheWrite1h: Type.Optional(Type.Number()),
  reasoning: Type.Optional(Type.Number()),
  totalTokens: Type.Number(),
  cost: Type.Object({
    input: Type.Number(),
    output: Type.Number(),
    cacheRead: Type.Number(),
    cacheWrite: Type.Number(),
    total: Type.Number(),
  }),
});

const userMessageSchema = Type.Object({
  role: Type.Literal("user"),
  content: Type.Union([
    Type.String(),
    Type.Array(Type.Union([textContentSchema, imageContentSchema])),
  ]),
  timestamp: Type.Number(),
});

const assistantMessageSchema = Type.Object({
  role: Type.Literal("assistant"),
  content: Type.Array(
    Type.Union([textContentSchema, thinkingContentSchema, toolCallSchema]),
  ),
  api: Type.String(),
  provider: Type.String(),
  model: Type.String(),
  responseModel: Type.Optional(Type.String()),
  responseId: Type.Optional(Type.String()),
  usage: usageSchema,
  stopReason: Type.Union([
    Type.Literal("pending"),
    Type.Literal("stop"),
    Type.Literal("length"),
    Type.Literal("toolUse"),
    Type.Literal("error"),
    Type.Literal("aborted"),
  ]),
  errorMessage: Type.Optional(Type.String()),
  rawStopReason: Type.Optional(Type.String()),
  timestamp: Type.Number(),
});

const toolResultMessageSchema = Type.Object({
  role: Type.Literal("toolResult"),
  toolCallId: Type.String(),
  toolName: Type.String(),
  content: Type.Array(Type.Union([textContentSchema, imageContentSchema])),
  details: Type.Optional(Type.Unknown()),
  usage: Type.Optional(usageSchema),
  addedToolNames: Type.Optional(Type.Array(Type.String())),
  isError: Type.Boolean(),
  timestamp: Type.Number(),
});

const customMessageContentSchema = Type.Union([
  Type.String(),
  Type.Array(Type.Union([textContentSchema, imageContentSchema])),
]);

export const agentMessageSchema = Type.Union([
  userMessageSchema,
  assistantMessageSchema,
  toolResultMessageSchema,
  Type.Object({
    role: Type.Literal("bashExecution"),
    command: Type.String(),
    output: Type.String(),
    exitCode: Type.Optional(Type.Number()),
    cancelled: Type.Boolean(),
    truncated: Type.Boolean(),
    fullOutputPath: Type.Optional(Type.String()),
    timestamp: Type.Number(),
    excludeFromContext: Type.Optional(Type.Boolean()),
  }),
  Type.Object({
    role: Type.Literal("custom"),
    customType: Type.String(),
    content: customMessageContentSchema,
    display: Type.Boolean(),
    details: Type.Optional(Type.Unknown()),
    timestamp: Type.Number(),
  }),
  Type.Object({
    role: Type.Literal("branchSummary"),
    summary: Type.String(),
    fromId: Type.String(),
    timestamp: Type.Number(),
  }),
  Type.Object({
    role: Type.Literal("compactionSummary"),
    summary: Type.String(),
    tokensBefore: Type.Number(),
    timestamp: Type.Number(),
  }),
]);

export type AgentMessage = Static<typeof agentMessageSchema>;

const assistantMessageUpdateSchema = Type.Union([
  Type.Object({ type: Type.Literal("start"), partial: assistantMessageSchema }),
  Type.Object({
    type: Type.Literal("text_start"),
    contentIndex: Type.Number(),
    partial: assistantMessageSchema,
  }),
  Type.Object({
    type: Type.Literal("text_delta"),
    contentIndex: Type.Number(),
    delta: Type.String(),
    partial: assistantMessageSchema,
  }),
  Type.Object({
    type: Type.Literal("text_end"),
    contentIndex: Type.Number(),
    content: Type.String(),
    partial: assistantMessageSchema,
  }),
  Type.Object({
    type: Type.Literal("thinking_start"),
    contentIndex: Type.Number(),
    partial: assistantMessageSchema,
  }),
  Type.Object({
    type: Type.Literal("thinking_delta"),
    contentIndex: Type.Number(),
    delta: Type.String(),
    partial: assistantMessageSchema,
  }),
  Type.Object({
    type: Type.Literal("thinking_end"),
    contentIndex: Type.Number(),
    content: Type.String(),
    partial: assistantMessageSchema,
  }),
  Type.Object({
    type: Type.Literal("toolcall_start"),
    contentIndex: Type.Number(),
    partial: assistantMessageSchema,
  }),
  Type.Object({
    type: Type.Literal("toolcall_delta"),
    contentIndex: Type.Number(),
    delta: Type.String(),
    partial: assistantMessageSchema,
  }),
  Type.Object({
    type: Type.Literal("toolcall_end"),
    contentIndex: Type.Number(),
    toolCall: toolCallSchema,
    partial: assistantMessageSchema,
  }),
  Type.Object({
    type: Type.Literal("done"),
    reason: Type.Union([
      Type.Literal("stop"),
      Type.Literal("length"),
      Type.Literal("toolUse"),
    ]),
    message: assistantMessageSchema,
  }),
  Type.Object({
    type: Type.Literal("error"),
    reason: Type.Union([Type.Literal("aborted"), Type.Literal("error")]),
    error: assistantMessageSchema,
  }),
]);

const toolIdentitySchema = Type.Object({
  path: Type.String(),
  displayName: Type.String(),
  integrationId: Type.Optional(Type.String()),
});

export type ToolIdentity = Static<typeof toolIdentitySchema>;

const toolInvocationSchema = Type.Object({
  id: Type.String(),
  runId: Type.String(),
  parentId: Type.Optional(Type.String()),
  tool: toolIdentitySchema,
  arguments: Type.Unknown(),
});

export type ToolInvocation = Static<typeof toolInvocationSchema>;

export const execActivityUpdateSchema = Type.Union([
  Type.Object({
    type: Type.Literal("tool.started"),
    invocation: Type.Object({
      id: Type.String(),
      parentId: Type.String(),
      tool: toolIdentitySchema,
      arguments: Type.Unknown(),
    }),
  }),
  Type.Object({
    type: Type.Literal("tool.finished"),
    invocationId: Type.String(),
    isError: Type.Boolean(),
  }),
]);

export type ExecActivityUpdate = Static<typeof execActivityUpdateSchema>;

const haloConnectionEventSchema = Type.Object({
  type: Type.Literal("halo.connection"),
  connectionId: Type.String(),
  request: connectionRequestSchema,
  status: Type.Union([
    Type.Literal("connected"),
    Type.Literal("cancelled"),
    Type.Literal("expired"),
  ]),
});

export type HaloConnectionEvent = Static<typeof haloConnectionEventSchema>;

const agentToolResultSchema = Type.Object({
  content: Type.Array(Type.Union([textContentSchema, imageContentSchema])),
  details: Type.Optional(Type.Unknown()),
  usage: Type.Optional(usageSchema),
  addedToolNames: Type.Optional(Type.Array(Type.String())),
  terminate: Type.Optional(Type.Boolean()),
});

export type AgentToolResult = Static<typeof agentToolResultSchema>;

export const sessionLogEventSchema = Type.Union([
  Type.Object({ type: Type.Literal("run.started"), runId: Type.String() }),
  Type.Object({
    type: Type.Literal("run.finished"),
    runId: Type.String(),
    outcome: Type.Union([
      Type.Literal("completed"),
      Type.Literal("interrupted"),
    ]),
  }),
  Type.Object({
    type: Type.Literal("message.committed"),
    message: agentMessageSchema,
  }),
  Type.Object({
    type: Type.Literal("assistant.updated"),
    runId: Type.String(),
    update: assistantMessageUpdateSchema,
  }),
  Type.Object({
    type: Type.Literal("tool.started"),
    invocation: toolInvocationSchema,
  }),
  Type.Object({
    type: Type.Literal("tool.updated"),
    invocationId: Type.String(),
    update: Type.Unknown(),
  }),
  Type.Object({
    type: Type.Literal("tool.finished"),
    invocationId: Type.String(),
    result: agentToolResultSchema,
    isError: Type.Boolean(),
  }),
  haloConnectionEventSchema,
]);

export type SessionLogEvent = Static<typeof sessionLogEventSchema>;

export const sessionLogRecordSchema = Type.Object({
  sequence: Type.Integer({ minimum: 1 }),
  value: sessionLogEventSchema,
});

export type SessionLogRecord = Static<typeof sessionLogRecordSchema>;

export type ProjectedToolInvocation = {
  invocation: ToolInvocation;
  update?: unknown;
  completion?: {
    result: AgentToolResult;
    isError: boolean;
  };
};

export type ProjectedSession = {
  messages: AgentMessage[];
  streamingMessage: AgentMessage | undefined;
  toolInvocations: ProjectedToolInvocation[];
  connectionEvents: HaloConnectionEvent[];
  activeRunId: string | undefined;
  error: string | undefined;
  isWorking: boolean;
};

export function projectSession(
  events: readonly SessionLogEvent[],
): ProjectedSession {
  const messages: AgentMessage[] = [];
  const toolInvocations = new Map<string, ProjectedToolInvocation>();
  const connectionEvents: HaloConnectionEvent[] = [];
  let streamingMessage: AgentMessage | undefined;
  let error: string | undefined;
  let activeRunId: string | undefined;

  for (const event of events) {
    switch (event.type) {
      case "run.started":
        activeRunId = event.runId;
        break;
      case "run.finished":
        if (event.runId === activeRunId) activeRunId = undefined;
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
        toolInvocations.set(event.invocation.id, {
          invocation: event.invocation,
        });
        break;
      case "tool.updated": {
        const tool = toolInvocations.get(event.invocationId);
        if (tool === undefined) break;
        toolInvocations.set(event.invocationId, {
          ...tool,
          update: event.update,
        });
        break;
      }
      case "tool.finished": {
        const tool = toolInvocations.get(event.invocationId);
        if (tool === undefined) break;
        toolInvocations.set(event.invocationId, {
          ...tool,
          completion: {
            result: event.result,
            isError: event.isError,
          },
        });
        break;
      }
      case "halo.connection":
        connectionEvents.push(event);
        break;
    }
  }

  return {
    messages,
    streamingMessage,
    toolInvocations: [...toolInvocations.values()],
    connectionEvents,
    activeRunId,
    error,
    isWorking: activeRunId !== undefined,
  };
}

function assistantMessageFromUpdate(
  update: Static<typeof assistantMessageUpdateSchema>,
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
