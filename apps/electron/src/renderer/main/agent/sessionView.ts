import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { AgentSessionState } from "@repo/shared/AgentSessionState";
import type { AgentMessage } from "@repo/shared/rpc";
import {
  connectionRequestLabel,
  connectionRequestSchema,
  type ConnectionRequest,
} from "@repo/shared/connectionRequests";

export type SessionViewItem =
  | { kind: "user"; id: string; text: string }
  | {
      kind: "assistantTurn";
      id: string;
      parts: SessionViewPart[];
    };

export type ToolPart = {
  id: string;
  toolName: string;
  args: ToolArgs;
  resultText?: string;
};

export type SessionViewPart =
  | { kind: "text"; id: string; text: string; streaming: boolean }
  | {
      kind: "toolActivity";
      id: string;
      summary: string;
      active: boolean;
      activeCalls: ToolPart[];
      completedCalls: ToolPart[];
    }
  | {
      kind: "executorConnection";
      id: string;
      request: ConnectionRequest;
    };

/** Tool call arguments as parsed from JSON — values may be any JSON-representable scalar or composite. */
type ToolArgValue =
  | string
  | number
  | boolean
  | ToolArgValue[]
  | { [K in string]: ToolArgValue };
type ToolArgs = { [K in string]: ToolArgValue };

type ToolPartLabel = {
  kind: "read" | "wrote" | "shell" | "exec" | "other";
  text: string;
};

type CollectedTool = {
  id: string;
  groupId: string;
  toolName: string;
  args: ToolArgs;
  resultText?: string;
  connectionRequests: ConnectionRequest[];
};

type TextSegment = {
  kind: "text";
  id: string;
  text: string;
  streaming: boolean;
};

type GroupSegment = {
  kind: "group";
  groupId: string;
  tools: CollectedTool[];
};

type TurnSegment = TextSegment | GroupSegment;

type PendingTurn = {
  id: string;
  segments: TurnSegment[];
};

const connectionDetailsSchema = Type.Object({
  connectionRequests: Type.Array(connectionRequestSchema),
});

const pathArgsSchema = Type.Object({
  path: Type.String(),
});

const bashArgsSchema = Type.Object({
  command: Type.String(),
});

/**
 * Project AgentSessionState into view rows: one user bubble per user message,
 * one assistant column per stretch of assistant activity (Pi TUI shape).
 * Tool calls on one assistant message are one parallel group. Assistant text
 * splits groups; adjacent tool-only groups stay one activity.
 */
export function sessionViewItems(state: AgentSessionState): SessionViewItem[] {
  const items: SessionViewItem[] = [];
  const toolResults = toolResultsByCallId(state);
  const emittedTools = new Set<string>();
  let pending: PendingTurn | undefined;

  function flush(live: boolean) {
    if (pending === undefined) return;
    const parts = projectTurn(pending, live);
    if (parts.length > 0) {
      items.push({
        kind: "assistantTurn",
        id: pending.id,
        parts,
      });
    }
    pending = undefined;
  }

  function openTurn(id: string): PendingTurn {
    if (pending === undefined) {
      pending = { id, segments: [] };
      return pending;
    }
    pending.id = id;
    return pending;
  }

  function pushAssistantMessage(message: AgentMessage, streaming: boolean) {
    if (message.role !== "assistant") return;
    const turn = openTurn(`assistant-${message.timestamp}`);
    const groupId = String(message.timestamp);
    let textIndex = 0;
    for (const part of message.content) {
      if (part.type === "text") {
        if (part.text.length === 0) continue;
        turn.segments.push({
          kind: "text",
          id: `text-${message.timestamp}-${textIndex}`,
          text: part.text,
          streaming,
        });
        textIndex += 1;
        continue;
      }
      if (part.type !== "toolCall") continue;
      if (emittedTools.has(part.id)) continue;
      emittedTools.add(part.id);
      const toolResult = toolResults.get(part.id);
      const collected: CollectedTool = {
        id: part.id,
        groupId,
        toolName: part.name,
        args: part.arguments,
        connectionRequests:
          toolResult === undefined ? [] : toolResult.connectionRequests,
      };
      if (toolResult !== undefined) {
        collected.resultText = toolResult.text;
      }
      const last = turn.segments.at(-1);
      if (
        last !== undefined &&
        last.kind === "group" &&
        last.groupId === groupId
      ) {
        last.tools.push(collected);
        continue;
      }
      turn.segments.push({
        kind: "group",
        groupId,
        tools: [collected],
      });
    }
  }

  for (const message of state.messages) {
    if (message.role === "user") {
      flush(false);
      items.push({
        kind: "user",
        id: `user-${message.timestamp}`,
        text: userText(message),
      });
      continue;
    }
    if (message.role === "assistant") {
      pushAssistantMessage(message, false);
      if (message.stopReason !== "toolUse") flush(false);
    }
  }

  if (state.streamingMessage !== undefined) {
    pushAssistantMessage(state.streamingMessage, true);
  }

  flush(state.isWorking);

  const last = items.at(-1);
  if (state.isWorking && (last === undefined || last.kind === "user")) {
    items.push({
      kind: "assistantTurn",
      id: "assistant-working",
      parts: [
        {
          kind: "toolActivity",
          id: "assistant-working-activity",
          summary: "Thinking",
          active: true,
          activeCalls: [],
          completedCalls: [],
        },
      ],
    });
  }

  return items;
}

/** Maui AiChat labels for Pi coding tools. */
export function toolPartLabel(
  part: {
    toolName: string;
    args: unknown;
  },
  workspaceRoot: string | undefined,
): ToolPartLabel {
  if (part.toolName === "exec") {
    return { kind: "exec", text: "Exec" };
  }

  if (part.toolName === "read") {
    if (!Value.Check(pathArgsSchema, part.args)) {
      return { kind: "other", text: part.toolName };
    }
    return {
      kind: "read",
      text: stripWorkspaceRootPrefix(part.args.path, workspaceRoot),
    };
  }

  if (part.toolName === "write" || part.toolName === "edit") {
    if (!Value.Check(pathArgsSchema, part.args)) {
      return { kind: "other", text: part.toolName };
    }
    return {
      kind: "wrote",
      text: stripWorkspaceRootPrefix(part.args.path, workspaceRoot),
    };
  }

  if (part.toolName === "bash") {
    if (!Value.Check(bashArgsSchema, part.args)) {
      return { kind: "other", text: part.toolName };
    }
    return { kind: "shell", text: part.args.command };
  }

  return { kind: "other", text: part.toolName };
}

const execArgsSchema = Type.Object({ js: Type.String() });

export function execJsSource(args: ToolArgs): string | undefined {
  if (!Value.Check(execArgsSchema, args)) return undefined;
  return args.js;
}

function projectTurn(turn: PendingTurn, live: boolean): SessionViewPart[] {
  const hasTools = turn.segments.some((segment) => segment.kind === "group");
  const hasText = turn.segments.some((segment) => segment.kind === "text");
  if (!hasTools) {
    if (live && !hasText) {
      return [
        {
          kind: "toolActivity",
          id: `${turn.id}-activity`,
          summary: "Thinking",
          active: true,
          activeCalls: [],
          completedCalls: [],
        },
      ];
    }
    return turn.segments.flatMap((segment) => {
      if (segment.kind !== "text") return [];
      return [
        {
          kind: "text" as const,
          id: segment.id,
          text: segment.text,
          streaming: segment.streaming,
        },
      ];
    });
  }

  const parts: SessionViewPart[] = [];
  let pendingGroups: GroupSegment[] = [];

  function flushGroups(active: boolean) {
    if (pendingGroups.length === 0) return;
    const tools = pendingGroups.flatMap((group) => group.tools);
    const lastGroupId = pendingGroups.at(-1)?.groupId;
    if (lastGroupId === undefined) return;
    const activity = groupActivity(tools, lastGroupId, active);
    if (activity !== undefined) parts.push(activity);
    for (const tool of tools) {
      for (const [index, request] of tool.connectionRequests.entries()) {
        parts.push({
          kind: "executorConnection",
          id: `${tool.id}-connection-${index}`,
          request,
        });
      }
    }
    pendingGroups = [];
  }

  for (const segment of turn.segments) {
    if (segment.kind === "text") {
      flushGroups(false);
      parts.push({
        kind: "text",
        id: segment.id,
        text: segment.text,
        streaming: segment.streaming,
      });
      continue;
    }
    pendingGroups.push(segment);
  }
  flushGroups(live);
  return parts;
}

function groupActivity(
  tools: CollectedTool[],
  lastGroupId: string,
  active: boolean,
): SessionViewPart | undefined {
  if (tools.length === 0) return undefined;

  const visible = tools.filter((call) => call.connectionRequests.length === 0);

  return {
    kind: "toolActivity",
    id: `assistant-${lastGroupId}-activity`,
    summary: activitySummary(tools),
    active,
    activeCalls: active
      ? visible.filter((call) => call.groupId === lastGroupId).map(toToolPart)
      : [],
    completedCalls: visible.map(toToolPart),
  };
}

function activitySummary(calls: CollectedTool[]): string {
  const finished = calls.filter((call) => call.resultText !== undefined);
  if (finished.length === 0) return "Working";

  let commands = 0;
  let reads = 0;
  let writes = 0;
  const integrations: string[] = [];
  const seenIntegrations = new Set<string>();

  for (const call of finished) {
    if (call.toolName === "bash") {
      commands += 1;
      continue;
    }
    if (call.toolName === "read") {
      reads += 1;
      continue;
    }
    if (
      call.toolName === "write" ||
      call.toolName === "edit" ||
      call.toolName === "patch"
    ) {
      writes += 1;
      continue;
    }
    const label = integrationLabel(call);
    if (seenIntegrations.has(label)) continue;
    seenIntegrations.add(label);
    integrations.push(label);
  }

  const chunks: string[] = [];
  if (commands === 1) chunks.push("ran 1 command");
  if (commands > 1) chunks.push(`ran ${commands} commands`);
  if (reads === 1) chunks.push("read 1 file");
  if (reads > 1) chunks.push(`read ${reads} files`);
  for (const label of integrations) {
    chunks.push(`used ${label}`);
  }
  if (writes === 1) chunks.push("wrote 1 file");
  if (writes > 1) chunks.push(`wrote ${writes} files`);

  return joinSummary(chunks);
}

function integrationLabel(call: CollectedTool): string {
  const request = call.connectionRequests[0];
  if (request !== undefined) return connectionRequestLabel(request);
  if (call.toolName === "exec") return "Exec";
  return titleCaseToolName(call.toolName);
}

function titleCaseToolName(name: string): string {
  return name
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function joinSummary(chunks: string[]): string {
  const first = chunks[0];
  if (first === undefined) return "Working";
  const capitalized = `${first.charAt(0).toUpperCase()}${first.slice(1)}`;
  const rest = chunks.slice(1);
  const last = rest.at(-1);
  if (last === undefined) return capitalized;
  if (rest.length === 1) return `${capitalized} and ${last}`;
  return `${capitalized}, ${rest.slice(0, -1).join(", ")}, and ${last}`;
}

function toToolPart(call: CollectedTool): ToolPart {
  const part: ToolPart = {
    id: call.id,
    toolName: call.toolName,
    args: call.args,
  };
  if (call.resultText !== undefined) {
    part.resultText = call.resultText;
  }
  return part;
}

function stripWorkspaceRootPrefix(
  filePath: string,
  workspaceRoot: string | undefined,
): string {
  if (workspaceRoot === undefined) return filePath;
  const root = toPosixPath(workspaceRoot).replace(/\/+$/, "");
  const posix = toPosixPath(filePath);
  if (posix === root) return ".";
  if (!posix.startsWith(`${root}/`)) return filePath;
  const relative = posix.slice(root.length + 1);
  if (relative.length === 0) return ".";
  return relative;
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function toolResultsByCallId(state: AgentSessionState) {
  const map = new Map<
    string,
    { text: string; connectionRequests: ConnectionRequest[] }
  >();
  for (const message of state.messages) {
    if (message.role !== "toolResult") continue;
    const connectionRequests = Value.Check(
      connectionDetailsSchema,
      message.details,
    )
      ? message.details.connectionRequests
      : [];
    map.set(message.toolCallId, {
      text: toolResultText(message),
      connectionRequests,
    });
  }
  return map;
}

function toolResultText(message: AgentMessage): string {
  if (message.role !== "toolResult") return "";
  return message.content
    .flatMap((part) => {
      if (part.type !== "text") return [];
      return [part.text];
    })
    .join("");
}

function userText(message: AgentMessage): string {
  if (message.role !== "user") return "";
  if (Array.isArray(message.content)) {
    return message.content
      .flatMap((part) => {
        if (part.type !== "text") return [];
        return [part.text];
      })
      .join("");
  }
  return message.content;
}
