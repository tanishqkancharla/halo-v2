import { createExecutionEngine } from "@executor-js/execution";
import { makeQuickJsExecutor } from "@executor-js/runtime-quickjs";
import { createExecutor, type Executor, ToolAddress } from "@executor-js/sdk";
import { definePlugin, tool } from "@executor-js/sdk/core";
import { Effect, Schema } from "effect";
import {
  type ToolRuntime,
  ToolRuntimeError,
  ToolRuntimeToolNotFoundError,
} from "./ToolRuntime.js";
import type { CredentialVault } from "./CredentialVault.js";
import { createExecutorCredentialProvider } from "./ExecutorCredentialProvider.js";
import { openExecutorDatabase } from "./ExecutorDatabase.js";

const haloRuntimePlugin = definePlugin(() => ({
  id: "halo_runtime" as const,
  storage: () => ({}),
  staticIntegrations: () => [
    {
      id: "halo_runtime",
      kind: "control",
      name: "Halo runtime",
      tools: [
        tool({
          name: "ping",
          description: "Return a static Halo runtime response.",
          inputSchema: Schema.toStandardSchemaV1(
            Schema.toStandardJSONSchemaV1(
              Schema.Struct({ message: Schema.String }),
            ),
          ),
          execute: ({ message }) => Effect.succeed({ message }),
        }),
      ],
    },
  ],
}));

type HaloRuntimePlugins = readonly [ReturnType<typeof haloRuntimePlugin>];

class ExecutorToolRuntime implements ToolRuntime {
  constructor(
    private readonly executor: Executor<HaloRuntimePlugins>,
    private readonly engine: ReturnType<typeof createExecutionEngine>,
  ) {}

  async executeCode(input: { code: string }) {
    const execution = await this.engine
      .execute(input.code, {
        onElicitation: async () => ({ action: "decline" as const }),
      })
      .catch(
        (cause) => new ToolRuntimeError({ operation: "code execution", cause }),
      );
    if (execution instanceof Error) return execution;
    return {
      value: execution.result,
      logs: execution.logs === undefined ? [] : [...execution.logs],
      error: execution.error,
    };
  }

  async invokeTool(input: { path: string; args: unknown }) {
    const invocation = await this.executor
      .execute(ToolAddress.make(input.path), input.args)
      .then((value) => ({ value }))
      .catch(
        (cause) =>
          new ToolRuntimeError({ operation: "tool invocation", cause }),
      );
    if (invocation instanceof Error) return invocation;
    return invocation;
  }

  async search(input: { query: string; limit?: number }) {
    const tools = await this.executor.tools
      .list({ query: input.query })
      .catch(
        (cause) => new ToolRuntimeError({ operation: "tool search", cause }),
      );
    if (tools instanceof Error) return tools;
    const items = tools.map((catalogTool) => ({
      path: catalogTool.address,
      name: catalogTool.name,
      description: catalogTool.description,
    }));
    if (input.limit === undefined) return items;
    return items.slice(0, input.limit);
  }

  async describe(input: { path: string }) {
    const description = await this.executor.tools
      .schema(ToolAddress.make(input.path))
      .catch(
        (cause) =>
          new ToolRuntimeError({ operation: "tool description", cause }),
      );
    if (description instanceof Error) return description;
    if (description === null) {
      return new ToolRuntimeToolNotFoundError({ path: input.path });
    }
    return {
      path: description.address,
      name: description.name,
      description: description.description,
      inputSchema: description.inputSchema,
      outputSchema: description.outputSchema,
      inputTypeScript: description.inputTypeScript,
      outputTypeScript: description.outputTypeScript,
    };
  }

  async close() {
    const closed = await this.executor
      .close()
      .catch((cause) => new ToolRuntimeError({ operation: "close", cause }));
    if (closed instanceof Error) return closed;
  }
}

// Electron composition will consume this when the runtime joins app lifecycle.
// oxlint-disable-next-line anti-slop/no-unused-exports
export async function createExecutorToolRuntime(input: {
  workspaceRoot: string;
  credentialVault: CredentialVault;
}): Promise<ToolRuntime | ToolRuntimeError> {
  const executor = await createExecutor({
    tenant: input.workspaceRoot,
    subject: "local",
    plugins: [haloRuntimePlugin()] as const,
    providers: [createExecutorCredentialProvider(input.credentialVault)],
    db: async ({ tables }) => {
      const database = await openExecutorDatabase({
        workspaceRoot: input.workspaceRoot,
        tables,
      });
      if (database instanceof Error) {
        throw new Error("Failed to open Executor database", {
          cause: database,
        });
      }
      return database;
    },
    onElicitation: "accept-all",
  }).catch((cause) => new ToolRuntimeError({ operation: "startup", cause }));
  if (executor instanceof Error) return executor;

  const engine = createExecutionEngine({
    executor,
    codeExecutor: makeQuickJsExecutor({
      timeoutMs: 2_000,
      memoryLimitBytes: 32 * 1024 * 1024,
      maxStackSizeBytes: 1024 * 1024,
    }),
  });
  return new ExecutorToolRuntime(executor, engine);
}
