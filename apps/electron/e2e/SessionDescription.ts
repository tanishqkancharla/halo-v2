import {
  m,
  type SessionDescription,
  type SessionDescriptionItem,
} from "@get-halo/shared/testing";
import crypto from "node:crypto";
import type { AgentMessage } from "@get-halo/shared/rpc";
import {
  projectSession,
  type SessionLogEvent,
  type ToolIdentity,
} from "@get-halo/shared/sessionLog";
import * as errore from "errore";

type SessionDescriptionEvent =
  | Exclude<SessionLogEvent, { type: "message.committed" }>
  | {
      type: "message.committed";
      message: Extract<
        AgentMessage,
        { role: "user" | "assistant" | "toolResult" }
      >;
    };

class LoadSessionError extends errore.createTaggedError({
  name: "LoadSessionError",
  message: "Could not load the described E2E session",
}) {}

class MissingSessionStartError extends errore.createTaggedError({
  name: "MissingSessionStartError",
  message: "No matching unfinished start for $description",
}) {}

const emptyUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
};

export async function loadSessionDescription(args: {
  description: SessionDescription;
  load(input: {
    title: string;
    events: SessionLogEvent[];
  }): Promise<{ sessionId: string }>;
  getToolIdentity(path: string): Promise<ToolIdentity>;
}) {
  const events = await sessionDescriptionEvents({
    items:
      args.description.messages === undefined ? [] : args.description.messages,
    history: [],
    getToolIdentity: args.getToolIdentity,
  });
  if (events instanceof Error) return events;

  return args
    .load({ title: args.description.title, events })
    .catch((cause) => new LoadSessionError({ cause }));
}

export async function sessionDescriptionEvents(args: {
  items: readonly SessionDescriptionItem[];
  history: readonly SessionLogEvent[];
  getToolIdentity(path: string): Promise<ToolIdentity>;
}): Promise<SessionDescriptionEvent[] | Error> {
  const events: SessionDescriptionEvent[] = [];
  for (const item of args.items) {
    const resolved = await resolveDescriptionItem({
      item,
      history: [...args.history, ...events],
      getToolIdentity: args.getToolIdentity,
    });
    if (resolved instanceof Error) return resolved;
    events.push(...resolved);
  }
  return events;
}

async function resolveDescriptionItem(args: {
  item: SessionDescriptionItem;
  history: readonly SessionLogEvent[];
  getToolIdentity(path: string): Promise<ToolIdentity>;
}): Promise<SessionDescriptionEvent[] | Error> {
  const { item, history } = args;
  const state = projectSession(history);
  const previousMessage = state.messages.at(-1);
  const timestamp =
    previousMessage === undefined
      ? Date.now()
      : Math.max(Date.now(), previousMessage.timestamp + 1);
  const missingStart = () =>
    new MissingSessionStartError({ description: JSON.stringify(item) });

  switch (item.type) {
    case "user":
      return [
        {
          type: "message.committed",
          message: { role: "user", content: item.text, timestamp },
        },
      ];
    case "assistant":
      return [
        {
          type: "message.committed",
          message: assistantMessage({
            content: [{ type: "text", text: item.text }],
            stopReason: "stop",
            timestamp,
          }),
        },
      ];
    case "run.start":
      return [
        {
          type: "run.started",
          runId: item.id === undefined ? crypto.randomUUID() : item.id,
        },
      ];
    case "run.end": {
      const runId = item.id === undefined ? state.activeRunId : item.id;
      if (runId === undefined || runId !== state.activeRunId)
        return missingStart();
      return [
        {
          type: "run.finished",
          runId,
          outcome: item.outcome === undefined ? "completed" : item.outcome,
        },
      ];
    }
    case "tool.start": {
      if (state.activeRunId === undefined) return missingStart();
      const parent = item.nested
        ? state.toolInvocations.find(
            ({ invocation }) => invocation.id === item.parentId,
          )?.invocation
        : undefined;
      if (item.nested && parent === undefined) return missingStart();
      const tool = item.nested
        ? await args
            .getToolIdentity(item.path)
            .catch((cause) => new LoadSessionError({ cause }))
        : directToolIdentity(item.path);
      if (tool instanceof Error) return tool;
      const invocation = {
        id: item.id,
        runId: state.activeRunId,
        parentId: parent?.id,
        tool,
        arguments: item.arguments === undefined ? {} : item.arguments,
      };
      const events: SessionDescriptionEvent[] = [];
      if (!item.nested) {
        events.push({
          type: "message.committed",
          message: assistantMessage({
            content: [
              {
                type: "toolCall",
                id: invocation.id,
                name: item.path,
                arguments: invocation.arguments,
              },
            ],
            stopReason: "toolUse",
            timestamp,
          }),
        });
      }
      events.push({ type: "tool.started", invocation });
      return events;
    }
    case "tool.end": {
      const invocation = state.toolInvocations.find(
        (entry) => entry.invocation.id === item.id,
      )?.invocation;
      if (invocation === undefined) return missingStart();
      const content =
        item.result === undefined
          ? []
          : [{ type: "text" as const, text: item.result }];
      const events: SessionDescriptionEvent[] = [
        {
          type: "tool.finished",
          invocationId: invocation.id,
          result: { content, details: item.details },
          isError: item.isError === true,
        },
      ];
      if (!item.nested) {
        events.push({
          type: "message.committed",
          message: {
            role: "toolResult",
            toolCallId: invocation.id,
            toolName: invocation.tool.path,
            content,
            details: item.details,
            isError: item.isError === true,
            timestamp,
          },
        });
      }
      return events;
    }
    case "connectionRequest":
      return sessionDescriptionEvents({
        ...args,
        items: [
          {
            type: "tool",
            name: "exec",
            arguments: { js: "" },
            result: "Connection required",
            details: { connectionRequests: [item.request] },
          },
        ],
      });
    case "tool":
    case "exec": {
      const items: SessionDescriptionItem[] = [];
      const standalone = state.activeRunId === undefined;
      const id = crypto.randomUUID();
      if (standalone) items.push(m.run.start());
      if (item.type === "exec") {
        items.push(m.exec.start({ id, js: item.js }));
        for (const tool of item.tools === undefined ? [] : item.tools) {
          const toolId = crypto.randomUUID();
          items.push(
            m.exec.tool.start(tool.path, {
              id: toolId,
              parentId: id,
              arguments: tool.arguments,
            }),
            m.exec.tool.end({
              id: toolId,
              result: tool.result,
              isError: tool.isError,
            }),
          );
        }
        items.push(
          m.exec.end({ id, result: item.result, isError: item.isError }),
        );
      } else {
        items.push(
          m.tool.start(item.name, { id, arguments: item.arguments }),
          m.tool.end({ id, result: item.result, details: item.details }),
        );
      }
      if (standalone) items.push(m.run.end());
      return sessionDescriptionEvents({ ...args, items });
    }
  }
}

function directToolIdentity(name: string): ToolIdentity {
  if (name === "bash") return { path: name, displayName: "Shell" };
  if (name === "edit") return { path: name, displayName: "Edit" };
  if (name === "exec") return { path: name, displayName: "Exec" };
  if (name === "patch") return { path: name, displayName: "Patch" };
  if (name === "read") return { path: name, displayName: "Read" };
  if (name === "write") return { path: name, displayName: "Write" };
  return { path: name, displayName: name };
}

function assistantMessage(args: {
  content: Extract<AgentMessage, { role: "assistant" }>["content"];
  stopReason: Extract<AgentMessage, { role: "assistant" }>["stopReason"];
  timestamp: number;
}): Extract<AgentMessage, { role: "assistant" }> {
  return {
    role: "assistant",
    content: args.content,
    api: "openai-codex-responses",
    provider: "openai-codex",
    model: "gpt-5.6-terra",
    usage: emptyUsage,
    stopReason: args.stopReason,
    timestamp: args.timestamp,
  };
}
