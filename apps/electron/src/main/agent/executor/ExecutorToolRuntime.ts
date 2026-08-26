import { AsyncLocalStorage } from "node:async_hooks";
import { createExecutionEngine } from "@executor-js/execution";
import {
  makeQuickJsExecutor,
  setQuickJSModule,
} from "@executor-js/runtime-quickjs";
import { createExecutor, type Executor, ToolAddress } from "@executor-js/sdk";
import { definePlugin, tool } from "@executor-js/sdk/core";
import quickJsVariant from "@jitl/quickjs-singlefile-cjs-release-sync";
import { type TObject } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { Effect } from "effect";
import {
  newQuickJSWASMModule,
  type QuickJSWASMModule,
} from "quickjs-emscripten";
import type { AgentAuthority } from "../AgentAuthority.js";
import type {
  HaloTool,
  HaloToolContext,
  HaloToolPlugin,
} from "../tools/HaloToolPlugin.js";
import {
  type ToolRuntime,
  ToolRuntimeError,
  ToolRuntimeToolNotFoundError,
} from "./ToolRuntime.js";
import type { CredentialVault } from "./CredentialVault.js";
import { createExecutorCredentialProvider } from "./ExecutorCredentialProvider.js";
import { openExecutorDatabase } from "./ExecutorDatabase.js";

type HaloToolsPluginOptions = {
  plugins: readonly HaloToolPlugin[];
  authority: AgentAuthority;
  executionContext: AsyncLocalStorage<HaloToolContext>;
};

const haloToolsPlugin = definePlugin((options?: HaloToolsPluginOptions) => {
  if (options === undefined) {
    throw new Error("haloToolsPlugin requires plugins and authority");
  }
  return {
    id: "halo-tools" as const,
    storage: () => ({}),
    staticIntegrations: () =>
      options.plugins.map((plugin) => ({
        id: plugin.id,
        kind: "halo",
        name: plugin.name,
        tools: plugin.tools.map((haloTool) =>
          toExecutorTool({
            pluginId: plugin.id,
            haloTool,
            authority: options.authority,
            executionContext: options.executionContext,
          }),
        ),
      })),
  };
});

type HaloRuntimePlugins = readonly [ReturnType<typeof haloToolsPlugin>];
let quickJsModulePromise: Promise<QuickJSWASMModule> | undefined;

function toExecutorTool(input: {
  pluginId: string;
  haloTool: HaloTool;
  authority: AgentAuthority;
  executionContext: AsyncLocalStorage<HaloToolContext>;
}) {
  return tool({
    name: input.haloTool.name,
    description: input.haloTool.description,
    inputSchema: toExecutorSchema(input.haloTool.inputSchema),
    execute: (args) =>
      Effect.promise(async () => {
        const authorization = await input.authority.authorize({
          pluginId: input.pluginId,
          toolName: input.haloTool.name,
          requiredCapabilities: input.haloTool.requiredCapabilities,
        });
        if (authorization instanceof Error) return authorization;
        return input.haloTool.execute(args, {
          signal: input.executionContext.getStore()?.signal,
        });
      }).pipe(
        Effect.flatMap((result) =>
          result instanceof Error
            ? Effect.fail(result)
            : Effect.succeed(result.value),
        ),
      ),
  });
}

function toExecutorSchema(schema: TObject) {
  const jsonSchema = { ...schema };
  return {
    "~standard": {
      version: 1 as const,
      vendor: "halo",
      // Standard Schema validation is the Executor input boundary.
      // oxlint-disable-next-line anti-slop/no-unknown-parameters
      validate: (value: unknown) => {
        if (Value.Check(schema, value)) return { value };
        return {
          issues: [...Value.Errors(schema, value)].map((issue) => ({
            message: issue.message,
          })),
        };
      },
      jsonSchema: {
        input: () => jsonSchema,
        output: () => jsonSchema,
      },
    },
  };
}

class ExecutorToolRuntime implements ToolRuntime {
  constructor(
    private readonly executor: Executor<HaloRuntimePlugins>,
    private readonly engine: ReturnType<typeof createExecutionEngine>,
    private readonly executionContext: AsyncLocalStorage<HaloToolContext>,
  ) {}

  async executeCode(input: { code: string; signal?: AbortSignal }) {
    const execution = await this.executionContext.run(
      { signal: input.signal },
      () =>
        this.engine
          .execute(input.code, {
            onElicitation: async () => ({ action: "decline" as const }),
          })
          .catch(
            (cause) =>
              new ToolRuntimeError({ operation: "code execution", cause }),
          ),
    );
    if (execution instanceof Error) return execution;
    return {
      value: execution.result,
      logs: execution.logs === undefined ? [] : [...execution.logs],
      error: execution.error,
    };
  }

  async invokeTool(input: {
    path: string;
    args: unknown;
    signal?: AbortSignal;
  }) {
    const invocation = await this.executionContext.run(
      { signal: input.signal },
      () =>
        this.executor
          .execute(ToolAddress.make(input.path), input.args)
          .then((value) => ({ value }))
          .catch(
            (cause) =>
              new ToolRuntimeError({ operation: "tool invocation", cause }),
          ),
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

export async function createExecutorToolRuntime(input: {
  workspaceRoot: string;
  userId: string;
  credentialVault: CredentialVault;
  toolPlugins: readonly HaloToolPlugin[];
  authority: AgentAuthority;
}): Promise<ToolRuntime | ToolRuntimeError> {
  if (quickJsModulePromise === undefined) {
    quickJsModulePromise = newQuickJSWASMModule(quickJsVariant);
  }
  const quickJsModule = await quickJsModulePromise.catch(
    (cause) =>
      new ToolRuntimeError({ operation: "QuickJS initialization", cause }),
  );
  if (quickJsModule instanceof Error) return quickJsModule;
  setQuickJSModule(quickJsModule);

  const executionContext = new AsyncLocalStorage<HaloToolContext>();
  const executor = await createExecutor({
    tenant: input.workspaceRoot,
    subject: input.userId,
    plugins: [
      haloToolsPlugin({
        plugins: input.toolPlugins,
        authority: input.authority,
        executionContext,
      }),
    ] as const,
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
  return new ExecutorToolRuntime(executor, engine, executionContext);
}
