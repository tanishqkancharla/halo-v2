import * as errore from "errore";

export class ToolRuntimeError extends errore.createTaggedError({
  name: "ToolRuntimeError",
  message: "Tool runtime failed during $operation",
}) {}

export class ToolRuntimeToolNotFoundError extends errore.createTaggedError({
  name: "ToolRuntimeToolNotFoundError",
  message: 'Tool "$path" was not found',
}) {}

type ToolRuntimeCodeResult = {
  value: unknown;
  logs: string[];
  error: string | undefined;
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
  }): Promise<ToolRuntimeCodeResult | ToolRuntimeError>;
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
  close(): Promise<void | ToolRuntimeError>;
}
