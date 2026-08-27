import * as errore from "errore";
import type { ConnectionRequest } from "../../../shared/connectionRequests.js";

export class ToolRuntimeError extends errore.createTaggedError({
  name: "ToolRuntimeError",
  message: "Tool runtime failed during $operation",
}) {}

export class ToolRuntimeToolNotFoundError extends errore.createTaggedError({
  name: "ToolRuntimeToolNotFoundError",
  message: 'Tool "$path" was not found',
}) {}

export class CodeExecutionError extends errore.createTaggedError({
  name: "CodeExecutionError",
}) {}

export class ConnectionRequiredError extends errore.createTaggedError({
  name: "ConnectionRequiredError",
  message:
    "A connection is required before this code can run. A connection card has been shown to the user. Tell them to use it to connect their account. You will be notified once they've finished connecting.",
}) {
  readonly connectionRequests: ConnectionRequest[];

  constructor(input: {
    connectionRequests: ConnectionRequest[];
    cause: Error | undefined;
  }) {
    super({ cause: input.cause });
    this.connectionRequests = input.connectionRequests;
  }
}

type ToolRuntimeCodeResult = {
  value: unknown;
  logs: string[];
};

type ToolRuntimeSearchItem = {
  path: string;
  name: string;
  description: string;
};

type ToolRuntimeInvocationResult = {
  value: unknown;
};

type ToolRuntimeToolDescription = {
  path: string;
  name: string | undefined;
  description: string | undefined;
  inputSchema: unknown;
  outputSchema: unknown;
  inputTypeScript: string | undefined;
  outputTypeScript: string | undefined;
};

export interface ToolRuntime {
  executeCode(input: {
    code: string;
    signal?: AbortSignal;
  }): Promise<
    | ToolRuntimeCodeResult
    | CodeExecutionError
    | ConnectionRequiredError
    | ToolRuntimeError
  >;
  invokeTool(input: {
    path: string;
    args: unknown;
    signal?: AbortSignal;
  }): Promise<ToolRuntimeInvocationResult | ToolRuntimeError>;
  search(input: {
    query: string;
    limit?: number;
  }): Promise<ToolRuntimeSearchItem[] | ToolRuntimeError>;
  describe(input: {
    path: string;
  }): Promise<
    ToolRuntimeToolDescription | ToolRuntimeError | ToolRuntimeToolNotFoundError
  >;
  completeOAuth(input: {
    state: string;
    code: string;
  }): Promise<void | ToolRuntimeError>;
  startOAuth(input: ConnectionRequest): Promise<void | ToolRuntimeError>;
  close(): Promise<void | ToolRuntimeError>;
}
