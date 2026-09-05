import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { ConnectionRequest } from "@get-halo/shared/connectionRequests";
import type { AgentMessage } from "@get-halo/shared/rpc";
import {
  projectSession,
  type ProjectedSession,
  type SessionLogEvent,
  type SessionLogRecord,
  type ToolIdentity,
  type ToolInvocation,
} from "@get-halo/shared/sessionLog";
import * as errore from "errore";

type ToolArguments = Extract<
  Extract<AgentMessage, { role: "assistant" }>["content"][number],
  { type: "toolCall" }
>["arguments"];

type SessionDescriptionEvent =
  | Exclude<SessionLogEvent, { type: "message.committed" }>
  | {
      type: "message.committed";
      message: Extract<
        AgentMessage,
        { role: "user" | "assistant" | "toolResult" }
      >;
    };

type ToolResultDetails = {
  connectionRequests?: ConnectionRequest[];
};

type ToolDescription = {
  path: string;
  arguments?: ToolArguments;
  result?: string;
  isError?: boolean;
};

type ExecDescription = {
  type: "exec";
  js: string;
  tools?: ToolDescription[];
  result?: string;
  isError?: boolean;
};

type ToolSelector = {
  id?: string;
  path?: string;
  parentId?: string;
};

type ToolStartOptions = {
  id?: string;
  parentId?: string;
  arguments?: ToolArguments;
};

type ToolEndOptions = ToolSelector & {
  result?: string;
  isError?: boolean;
  details?: ToolResultDetails;
};

export type SessionDescription = {
  title: string;
  messages?: SessionDescriptionItem[];
};

export type SessionDescriptionItem =
  | { type: "user"; text: string }
  | { type: "assistant"; text: string }
  | {
      type: "tool";
      name: string;
      arguments: ToolArguments;
      result: string;
      details?: ToolResultDetails;
    }
  | { type: "connectionRequest"; request: ConnectionRequest }
  | ExecDescription
  | { type: "run.start"; id?: string }
  | {
      type: "run.end";
      id?: string;
      outcome?: "completed" | "interrupted";
    }
  | ({ type: "tool.start"; nested: boolean; path: string } & ToolStartOptions)
  | ({ type: "tool.end"; nested: boolean } & ToolEndOptions);

function toolLifecycle(nested: boolean) {
  return {
    start(toolPath: string, options: ToolStartOptions = {}) {
      return {
        type: "tool.start" as const,
        nested,
        path: toolPath,
        ...options,
      };
    },
    end(options: ToolEndOptions = {}) {
      return { type: "tool.end" as const, nested, ...options };
    },
  };
}

export const m = {
  run: {
    start(options: { id?: string } = {}) {
      return { type: "run.start" as const, ...options };
    },
    end(options: { id?: string; outcome?: "completed" | "interrupted" } = {}) {
      return { type: "run.end" as const, ...options };
    },
  },
  tool: toolLifecycle(false),
  user(text: string) {
    return { type: "user" as const, text };
  },
  assistant(text: string) {
    return { type: "assistant" as const, text };
  },
  read(input: { path: string; result: string }) {
    return {
      type: "tool" as const,
      name: "read",
      arguments: { path: input.path },
      result: input.result,
    };
  },
  edit(input: {
    path: string;
    oldText: string;
    newText: string;
    result: string;
  }) {
    return {
      type: "tool" as const,
      name: "edit",
      arguments: {
        path: input.path,
        oldText: input.oldText,
        newText: input.newText,
      },
      result: input.result,
    };
  },
  write(input: { path: string; content: string; result: string }) {
    return {
      type: "tool" as const,
      name: "write",
      arguments: { path: input.path, content: input.content },
      result: input.result,
    };
  },
  patch(input: { patchText: string; result: string }) {
    return {
      type: "tool" as const,
      name: "patch",
      arguments: { patchText: input.patchText },
      result: input.result,
    };
  },
  bash(input: { command: string; result: string }) {
    return {
      type: "tool" as const,
      name: "bash",
      arguments: { command: input.command },
      result: input.result,
    };
  },
  exec: Object.assign(
    (input: Omit<ExecDescription, "type">) => ({
      type: "exec" as const,
      ...input,
    }),
    {
      start(input: { js: string; id?: string }) {
        return {
          type: "tool.start" as const,
          nested: false,
          path: "exec",
          id: input.id,
          arguments: { js: input.js },
        };
      },
      end(options: Omit<ToolEndOptions, "path" | "parentId"> = {}) {
        return {
          type: "tool.end" as const,
          nested: false,
          path: "exec",
          ...options,
        };
      },
      tool: toolLifecycle(true),
    },
  ),
  connectionRequest(request: ConnectionRequest) {
    return { type: "connectionRequest" as const, request };
  },
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
  workspaceRoot: string;
  getToolIdentity(path: string): Promise<ToolIdentity>;
}) {
  const events = await sessionDescriptionEvents({
    items:
      args.description.messages === undefined ? [] : args.description.messages,
    history: [],
    getToolIdentity: args.getToolIdentity,
  });
  if (events instanceof Error) return events;

  return errore.try({
    try: () => {
      const manager = SessionManager.create(
        args.workspaceRoot,
        path.join(args.workspaceRoot, ".pi", "agent", "sessions"),
      );
      manager.appendSessionInfo(args.description.title);
      for (const event of events) {
        if (event.type !== "message.committed") continue;
        manager.appendMessage(event.message);
      }
      if (
        !events.some(
          (event) =>
            event.type === "message.committed" &&
            event.message.role === "assistant",
        )
      ) {
        // Pi delays creating a session file until its first assistant message.
        manager.appendMessage(
          assistantMessage({
            content: [],
            stopReason: "stop",
            timestamp: Date.now(),
          }),
        );
      }
      const sessionId = manager.getSessionId();
      const records: SessionLogRecord[] = events.map((value, index) => ({
        sequence: index + 1,
        value,
      }));
      fs.writeFileSync(
        path.join(
          args.workspaceRoot,
          ".pi",
          "agent",
          "sessions",
          `${sessionId}.halo-events.jsonl`,
        ),
        records.length === 0
          ? ""
          : `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
      );
      return { sessionId };
    },
    catch: (cause) => new LoadSessionError({ cause }),
  });
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
        ? findTool({
            state,
            selector: { id: item.parentId, path: "exec" },
            nested: false,
          })
        : undefined;
      if (item.nested && parent === undefined) return missingStart();
      const tool = item.nested
        ? await args
            .getToolIdentity(item.path)
            .catch((cause) => new LoadSessionError({ cause }))
        : directToolIdentity(item.path);
      if (tool instanceof Error) return tool;
      const invocation = {
        id: item.id === undefined ? crypto.randomUUID() : item.id,
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
      const invocation = findTool({
        state,
        selector: item,
        nested: item.nested,
      });
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
      if (standalone) items.push(m.run.start());
      if (item.type === "exec") {
        items.push(m.exec.start({ js: item.js }));
        for (const tool of item.tools === undefined ? [] : item.tools) {
          items.push(
            m.exec.tool.start(tool.path, { arguments: tool.arguments }),
            m.exec.tool.end({ result: tool.result, isError: tool.isError }),
          );
        }
        items.push(m.exec.end({ result: item.result, isError: item.isError }));
      } else {
        items.push(
          m.tool.start(item.name, { arguments: item.arguments }),
          m.tool.end({ result: item.result, details: item.details }),
        );
      }
      if (standalone) items.push(m.run.end());
      return sessionDescriptionEvents({ ...args, items });
    }
  }
}

function findTool(args: {
  state: ProjectedSession;
  selector: ToolSelector;
  nested: boolean;
}): ToolInvocation | undefined {
  const { state, selector, nested } = args;
  const parent =
    nested && selector.id === undefined
      ? findTool({
          state,
          selector: { id: selector.parentId, path: "exec" },
          nested: false,
        })
      : undefined;
  return state.toolInvocations.findLast(
    ({ invocation, completion }) =>
      completion === undefined &&
      invocation.runId === state.activeRunId &&
      (invocation.parentId !== undefined) === nested &&
      (selector.path === undefined || invocation.tool.path === selector.path) &&
      (selector.id === undefined
        ? !nested || (parent !== undefined && invocation.parentId === parent.id)
        : invocation.id === selector.id),
  )?.invocation;
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
