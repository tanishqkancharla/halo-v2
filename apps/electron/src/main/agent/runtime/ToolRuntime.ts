import { AsyncLocalStorage } from "node:async_hooks";
import {
  createExecutionEngine,
  INTEGRATION_INVENTORY_HEADER,
} from "@executor-js/execution/core";
import { openApiPlugin } from "@executor-js/plugin-openapi/core";
import {
  googleCatalog,
  googleCatalogOAuthScopesForPreset,
  googleDiscoveryAdapter,
} from "@executor-js/plugin-openapi/providers/google";
import {
  makeQuickJsExecutor,
  setQuickJSModule,
} from "@executor-js/runtime-quickjs";
import {
  AuthTemplateSlug,
  ConnectionName,
  createExecutor,
  definePlugin,
  Effect,
  type ElicitationContext,
  type Executor,
  type FirstPartyOAuthClientConfig,
  type IntegrationPreset,
  IntegrationSlug,
  OAuthClientSlug,
  OAuthState,
  Owner,
  StorageError,
  Subject,
  Tenant,
  tool,
  ToolAddress,
} from "@executor-js/sdk/core";
import quickJsVariant from "@jitl/quickjs-singlefile-cjs-release-sync";
import { type Static, type TObject, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  newQuickJSWASMModule,
  type QuickJSWASMModule,
} from "quickjs-emscripten";
import * as errore from "errore";
import type { ConnectionRequest } from "../../../shared/connectionRequests.js";
import type {
  HaloTool,
  HaloToolContext,
  HaloToolPlugin,
} from "../tools/HaloToolPlugin.js";
import type { AgentAuthority } from "./AgentAuthority.js";
import type { CredentialVault } from "./CredentialVault.js";
import { createExecutorCredentialProvider } from "./ExecutorCredentialProvider.js";
import { openExecutorDatabase } from "./ExecutorDatabase.js";

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

type HaloToolsPluginOptions = {
  plugins: readonly HaloToolPlugin[];
  authority: AgentAuthority;
  executionContext: AsyncLocalStorage<
    Pick<HaloToolContext, "signal" | "modelId">
  >;
  context: Pick<HaloToolContext, "workspaceRoot" | "userId">;
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
            context: options.context,
          }),
        ),
      })),
  };
});

let quickJsModulePromise: Promise<QuickJSWASMModule> | undefined;

type InstallableGooglePreset = IntegrationPreset & {
  defaultSlug: string;
  specFormat: string;
  url: string;
};

// Executor 1.6 rewrites Meet's service-hosted Discovery URL to a legacy endpoint that returns 404.
const googlePresets = googleCatalog.filter(
  (preset) => preset.id !== "google-meet",
);

const installableGooglePresets = googlePresets.filter(
  (preset): preset is InstallableGooglePreset =>
    preset.defaultSlug !== undefined &&
    preset.specFormat !== undefined &&
    preset.url !== undefined,
);

const googleOpenApiPlugin = openApiPlugin({
  presets: googlePresets,
  specFormats: [googleDiscoveryAdapter],
});

const googleOAuthClient: FirstPartyOAuthClientConfig = {
  name: "google",
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientId:
    "536106843012-1gteqlblqk8pkr1ov4dgd6m867otjrdo.apps.googleusercontent.com",
  // Google desktop apps receive a secret, but Google does not treat it as confidential.
  clientSecret: "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",
  integrations: installableGooglePresets.map((preset) =>
    IntegrationSlug.make(preset.defaultSlug),
  ),
  allowedScopes: [
    ...new Set(
      googlePresets.flatMap((preset) =>
        googleCatalogOAuthScopesForPreset(preset.id),
      ),
    ),
  ],
};

const oauthStartAddress = "executor.coreTools.oauth.start";
const oauthStartInputSchema = Type.Object({
  client: Type.String(),
  clientOwner: Type.Union([Type.Literal("org"), Type.Literal("user")]),
  owner: Type.Union([Type.Literal("org"), Type.Literal("user")]),
  name: Type.String(),
  integration: Type.String(),
  template: Type.String(),
  identityLabel: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  newConnection: Type.Optional(Type.Boolean()),
});

type HaloRuntimePlugins = readonly [
  ReturnType<typeof haloToolsPlugin>,
  typeof googleOpenApiPlugin,
];

function toExecutorTool(input: {
  pluginId: string;
  haloTool: HaloTool;
  authority: AgentAuthority;
  executionContext: AsyncLocalStorage<
    Pick<HaloToolContext, "signal" | "modelId">
  >;
  context: Pick<HaloToolContext, "workspaceRoot" | "userId">;
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
        const context = input.executionContext.getStore();
        return input.haloTool.execute(args, {
          ...input.context,
          signal: context?.signal,
          modelId: context?.modelId,
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

type ToolRuntimeOptions = {
  workspaceRoot: string;
  userId: string;
  credentialVault: CredentialVault;
  toolPlugins: readonly HaloToolPlugin[];
  authority: AgentAuthority;
  oauthRedirectUri: string | undefined;
};

export class ToolRuntime {
  static create(input: ToolRuntimeOptions) {
    return createToolRuntime(input);
  }

  constructor(
    private readonly executor: Executor<HaloRuntimePlugins>,
    private readonly engine: ReturnType<typeof createExecutionEngine>,
    private readonly executionContext: AsyncLocalStorage<
      Pick<HaloToolContext, "signal" | "modelId">
    >,
    private readonly toolPlugins: readonly HaloToolPlugin[],
    private readonly authority: AgentAuthority,
  ) {}

  async getAgentDescription() {
    const executorDescription = await Effect.runPromise(
      this.engine.getDescription,
    ).catch(
      (cause) =>
        new ToolRuntimeError({ operation: "agent description", cause }),
    );
    if (executorDescription instanceof Error) return executorDescription;

    const inventoryStart = executorDescription.indexOf(
      INTEGRATION_INVENTORY_HEADER,
    );
    const integrationInventory =
      inventoryStart === -1
        ? "## Connected integrations\n\nNo integrations are connected."
        : executorDescription.slice(inventoryStart);
    const toolStatuses = await Promise.all(
      this.toolPlugins.flatMap((plugin) =>
        plugin.tools.map(async (haloTool) => {
          const authorization = await this.authority.authorize({
            pluginId: plugin.id,
            toolName: haloTool.name,
            requiredCapabilities: haloTool.requiredCapabilities,
          });
          return {
            path: `${plugin.id}.${haloTool.name}`,
            status: authorization instanceof Error ? "blocked" : "granted",
          };
        }),
      ),
    );
    const haloTools = [
      "## Halo tools",
      "",
      "Tools configured for this session:",
      ...toolStatuses.map(
        (status) => `- \`${status.path}\` — ${status.status}`,
      ),
    ].join("\n");

    return [
      "Run JavaScript in Halo's sandbox with the tools available below.",
      haloTools,
      integrationInventory,
      "Other integrations can be discovered and connected when needed.",
    ].join("\n\n");
  }

  async executeCode(input: {
    code: string;
    signal?: AbortSignal;
    modelId?: string;
  }) {
    const connectionRequests: ConnectionRequest[] = [];
    const execution = await this.executionContext.run(
      { signal: input.signal, modelId: input.modelId },
      () =>
        Effect.runPromise(
          this.engine.execute(input.code, {
            onElicitation: (context) => {
              const connection = connectionInput(context);
              if (connection !== undefined) {
                connectionRequests.push(connection);
              }
              return Effect.succeed({ action: "decline" });
            },
          }),
        ).catch(
          (cause) =>
            new ToolRuntimeError({ operation: "code execution", cause }),
        ),
    );
    if (execution instanceof Error) return execution;
    const cause =
      execution.error === undefined ? undefined : new Error(execution.error);
    if (connectionRequests.length > 0) {
      return new ConnectionRequiredError({ connectionRequests, cause });
    }
    if (execution.error !== undefined) {
      return new CodeExecutionError({ message: execution.error, cause });
    }
    return {
      value: execution.result,
      logs: execution.logs === undefined ? [] : [...execution.logs],
    };
  }

  async invokeTool(input: {
    path: string;
    args: unknown;
    signal?: AbortSignal;
    modelId?: string;
  }) {
    const invocation = await this.executionContext.run(
      { signal: input.signal, modelId: input.modelId },
      () =>
        Effect.runPromise(
          this.executor.execute(ToolAddress.make(input.path), input.args),
        )
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
    const tools = await Effect.runPromise(
      this.executor.tools.list({ query: input.query }),
    ).catch(
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
    const description = await Effect.runPromise(
      this.executor.tools.schema(ToolAddress.make(input.path)),
    ).catch(
      (cause) => new ToolRuntimeError({ operation: "tool description", cause }),
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

  async completeOAuth(input: { state: string; code: string }) {
    const completed = await Effect.runPromise(
      this.executor.oauth.complete({
        state: OAuthState.make(input.state),
        code: input.code,
      }),
    ).catch(
      (cause) => new ToolRuntimeError({ operation: "OAuth completion", cause }),
    );
    if (completed instanceof Error) return completed;
  }

  async startOAuth(input: ConnectionRequest) {
    const started = await Effect.runPromise(
      this.executor.oauth.start({
        client: OAuthClientSlug.make(input.client),
        clientOwner: Owner.make(input.clientOwner),
        owner: Owner.make(input.owner),
        name: ConnectionName.make(input.connectionName),
        integration: IntegrationSlug.make(input.integration),
        template: AuthTemplateSlug.make(input.template),
        identityLabel: input.identityLabel,
        newConnection: input.newConnection,
      }),
    ).catch(
      (cause) => new ToolRuntimeError({ operation: "OAuth start", cause }),
    );
    if (started instanceof Error) return started;
    if (started.status === "connected") return { status: "connected" as const };
    return {
      status: "redirect" as const,
      authorizationUrl: started.authorizationUrl,
      state: started.state,
    };
  }

  async cancelOAuth(state: string) {
    const cancelled = await Effect.runPromise(
      this.executor.oauth.cancel(OAuthState.make(state)),
    ).catch(
      (cause) =>
        new ToolRuntimeError({ operation: "OAuth cancellation", cause }),
    );
    if (cancelled instanceof Error) return cancelled;
  }

  async close() {
    const [executorClosed, pluginResults] = await Promise.all([
      Effect.runPromise(this.executor.close()).catch(
        (cause) => new ToolRuntimeError({ operation: "close", cause }),
      ),
      Promise.all(
        this.toolPlugins.map((plugin) =>
          plugin.close === undefined ? undefined : plugin.close(),
        ),
      ),
    ]);
    if (executorClosed instanceof Error) return executorClosed;
    const pluginError = pluginResults.find((result) => result instanceof Error);
    if (pluginError instanceof Error) {
      return new ToolRuntimeError({
        operation: "tool shutdown",
        cause: pluginError,
      });
    }
  }
}

async function createToolRuntime(
  input: ToolRuntimeOptions,
): Promise<ToolRuntime | ToolRuntimeError> {
  if (quickJsModulePromise === undefined) {
    quickJsModulePromise = newQuickJSWASMModule(quickJsVariant);
  }
  const quickJsModule = await quickJsModulePromise.catch(
    (cause) =>
      new ToolRuntimeError({ operation: "QuickJS initialization", cause }),
  );
  if (quickJsModule instanceof Error) return quickJsModule;
  setQuickJSModule(quickJsModule);

  const executionContext = new AsyncLocalStorage<
    Pick<HaloToolContext, "signal" | "modelId">
  >();
  const executor = await Effect.runPromise(
    createExecutor({
      tenant: Tenant.make(input.workspaceRoot),
      subject: Subject.make(input.userId),
      plugins: [
        haloToolsPlugin({
          plugins: input.toolPlugins,
          authority: input.authority,
          executionContext,
          context: {
            workspaceRoot: input.workspaceRoot,
            userId: input.userId,
          },
        }),
        googleOpenApiPlugin,
      ] as const,
      providers: [createExecutorCredentialProvider(input.credentialVault)],
      coreTools: { includeProviders: true },
      redirectUri: input.oauthRedirectUri,
      firstPartyOAuthClients: [googleOAuthClient],
      db: ({ tables }) =>
        Effect.promise(() =>
          openExecutorDatabase({
            workspaceRoot: input.workspaceRoot,
            tables,
          }),
        ).pipe(
          Effect.flatMap((database) => {
            if (database instanceof Error) {
              return Effect.fail(
                new StorageError({
                  message: "Failed to open Executor database",
                  cause: database,
                }),
              );
            }
            return Effect.succeed(database);
          }),
        ),
      onElicitation: "accept-all",
    }),
  ).catch((cause) => new ToolRuntimeError({ operation: "startup", cause }));
  if (executor instanceof Error) return executor;

  const installed = await installGooglePresets(executor);
  if (installed instanceof Error) {
    const closed = await Effect.runPromise(executor.close()).catch(
      (cause) => new ToolRuntimeError({ operation: "close", cause }),
    );
    if (closed instanceof Error) {
      console.warn("Failed to close Executor after Google setup:", closed);
    }
    return installed;
  }

  const engine = createExecutionEngine({
    executor,
    codeExecutor: makeQuickJsExecutor({
      timeoutMs: 2_000,
      memoryLimitBytes: 32 * 1024 * 1024,
      maxStackSizeBytes: 1024 * 1024,
    }),
  });
  return new ToolRuntime(
    executor,
    engine,
    executionContext,
    input.toolPlugins,
    input.authority,
  );
}

function connectionInput(
  context: ElicitationContext,
): ConnectionRequest | undefined {
  if (context.address !== oauthStartAddress) return undefined;
  if (!Value.Check(oauthStartInputSchema, context.args)) return undefined;
  const args: Static<typeof oauthStartInputSchema> = context.args;
  return {
    client: args.client,
    clientOwner: args.clientOwner,
    owner: args.owner,
    connectionName: args.name,
    integration: args.integration,
    template: args.template,
    identityLabel: args.identityLabel === null ? undefined : args.identityLabel,
    newConnection: args.newConnection,
  };
}

async function installGooglePresets(executor: Executor<HaloRuntimePlugins>) {
  if (installableGooglePresets.length !== googlePresets.length) {
    return new ToolRuntimeError({
      operation: "Google integration catalog",
      cause: new Error("Executor has a Google preset that cannot be installed"),
    });
  }

  for (const preset of installableGooglePresets) {
    const existing = await Effect.runPromise(
      executor.integrations.get(IntegrationSlug.make(preset.defaultSlug)),
    ).catch(
      (cause) =>
        new ToolRuntimeError({
          operation: `Google integration lookup (${preset.id})`,
          cause,
        }),
    );
    if (existing instanceof Error) return existing;
    if (existing !== null) continue;

    const authenticationTemplate = preset.authTemplate?.flatMap((method) =>
      method.kind === "oauth2" ? [method] : [],
    );
    const added = await Effect.runPromise(
      executor.openapi.addSpec({
        spec: { kind: "url", url: preset.url },
        slug: preset.defaultSlug,
        name: preset.name,
        description: preset.summary,
        specFormat: preset.specFormat,
        family: preset.family,
        authenticationTemplate,
        healthCheck: preset.healthCheck,
      }),
    ).catch(
      (cause) =>
        new ToolRuntimeError({
          operation: `Google integration setup (${preset.id})`,
          cause,
        }),
    );
    if (added instanceof Error) return added;
  }
}
