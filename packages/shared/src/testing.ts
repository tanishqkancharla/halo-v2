import type { ConnectionRequest } from "./connectionRequests.js";
import type { AgentMessage } from "./sessionLog.js";

type ToolArguments = Extract<
  Extract<AgentMessage, { role: "assistant" }>["content"][number],
  { type: "toolCall" }
>["arguments"];

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

type ToolStartOptions = {
  id: string;
  parentId?: string;
  arguments?: ToolArguments;
};

type ToolEndOptions = {
  id: string;
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

type ToolDialect = {
  start(
    toolPath: string,
    options: ToolStartOptions,
  ): Extract<SessionDescriptionItem, { type: "tool.start" }>;
  end(
    options: ToolEndOptions,
  ): Extract<SessionDescriptionItem, { type: "tool.end" }>;
};

type ToolMessage = Extract<SessionDescriptionItem, { type: "tool" }>;

export type MessageDialect = {
  run: {
    start(options?: {
      id?: string;
    }): Extract<SessionDescriptionItem, { type: "run.start" }>;
    end(options?: {
      id?: string;
      outcome?: "completed" | "interrupted";
    }): Extract<SessionDescriptionItem, { type: "run.end" }>;
  };
  tool: ToolDialect;
  user(text: string): Extract<SessionDescriptionItem, { type: "user" }>;
  assistant(
    text: string,
  ): Extract<SessionDescriptionItem, { type: "assistant" }>;
  error(message: string): { type: "error"; message: string };
  read(input: { path: string; result: string }): ToolMessage;
  edit(input: {
    path: string;
    oldText: string;
    newText: string;
    result: string;
  }): ToolMessage;
  write(input: { path: string; content: string; result: string }): ToolMessage;
  patch(input: { patchText: string; result: string }): ToolMessage;
  bash(input: { command: string; result: string }): ToolMessage;
  exec: ((input: Omit<ExecDescription, "type">) => ExecDescription) & {
    start(input: {
      js: string;
      id: string;
    }): Extract<SessionDescriptionItem, { type: "tool.start" }>;
    end: ToolDialect["end"];
    tool: ToolDialect;
  };
  connectionRequest(
    request: ConnectionRequest,
  ): Extract<SessionDescriptionItem, { type: "connectionRequest" }>;
};

export const m: MessageDialect = {
  run: {
    start(options = {}) {
      return { type: "run.start", ...options };
    },
    end(options = {}) {
      return { type: "run.end", ...options };
    },
  },
  tool: {
    start(toolPath, options) {
      return { type: "tool.start", nested: false, path: toolPath, ...options };
    },
    end(options) {
      return { type: "tool.end", nested: false, ...options };
    },
  },
  user(text) {
    return { type: "user", text };
  },
  assistant(text) {
    return { type: "assistant", text };
  },
  error(message) {
    return { type: "error", message };
  },
  read(input) {
    return {
      type: "tool",
      name: "read",
      arguments: { path: input.path },
      result: input.result,
    };
  },
  edit(input) {
    return {
      type: "tool",
      name: "edit",
      arguments: {
        path: input.path,
        oldText: input.oldText,
        newText: input.newText,
      },
      result: input.result,
    };
  },
  write(input) {
    return {
      type: "tool",
      name: "write",
      arguments: { path: input.path, content: input.content },
      result: input.result,
    };
  },
  patch(input) {
    return {
      type: "tool",
      name: "patch",
      arguments: { patchText: input.patchText },
      result: input.result,
    };
  },
  bash(input) {
    return {
      type: "tool",
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
      start(input: { js: string; id: string }) {
        return {
          type: "tool.start" as const,
          nested: false,
          path: "exec",
          id: input.id,
          arguments: { js: input.js },
        };
      },
      end(options: ToolEndOptions) {
        return {
          type: "tool.end" as const,
          nested: false,
          ...options,
        };
      },
      tool: {
        start(toolPath: string, options: ToolStartOptions) {
          return {
            type: "tool.start" as const,
            nested: true,
            path: toolPath,
            ...options,
          };
        },
        end(options: ToolEndOptions) {
          return { type: "tool.end" as const, nested: true, ...options };
        },
      },
    },
  ),
  connectionRequest(request) {
    return { type: "connectionRequest", request };
  },
};
