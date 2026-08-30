import { createPluginToolsFacade } from "@halo/plugin-sdk/host";
import { Type } from "@sinclair/typebox";
import * as errore from "errore";
import { isCallable } from "../../../../shared/isCallable.js";
import {
  defineHaloTool,
  type HaloToolContext,
  type HaloToolExecution,
  type HaloToolPlugin,
} from "../HaloToolPlugin.js";

export class PluginToolStreamingUnsupportedError extends errore.createTaggedError(
  {
    name: "PluginToolStreamingUnsupportedError",
    message: "Agent plugin invocation does not support streaming procedures",
  },
) {}

const emptyInput = Type.Object({});
const pluginInput = Type.Object({
  pluginId: Type.String({ minLength: 1 }),
});
const createInput = Type.Object({
  id: Type.String({ minLength: 1 }),
});
const invokeInput = Type.Object({
  pluginId: Type.String({ minLength: 1 }),
  path: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  input: Type.Optional(Type.Unknown()),
});

export const pluginManagementPlugin: HaloToolPlugin = {
  id: "plugins",
  name: "Plugins",
  tools: [
    defineHaloTool({
      name: "list",
      description: "List Halo workspace plugins.",
      inputSchema: emptyInput,
      requiredCapabilities: ["halo.plugins.manage"],
      execute: async (_input, context) => execution(context.plugins.list()),
    }),
    defineHaloTool({
      name: "create",
      description: "Create a Halo workspace plugin.",
      inputSchema: createInput,
      requiredCapabilities: ["halo.plugins.manage"],
      execute: async (input, context) =>
        execution(context.plugins.create(input.id)),
    }),
    defineHaloTool({
      name: "build",
      description: "Build all Halo workspace plugins.",
      inputSchema: emptyInput,
      requiredCapabilities: ["halo.plugins.manage"],
      execute: async (_input, context) => execution(context.plugins.build()),
    }),
    defineHaloTool({
      name: "types",
      description: "Install SDK types and typecheck Halo workspace plugins.",
      inputSchema: emptyInput,
      requiredCapabilities: ["halo.plugins.manage"],
      execute: async (_input, context) => execution(context.plugins.types()),
    }),
    defineHaloTool({
      name: "check",
      description:
        "Compare a plugin's requested tools with its grants and the live Executor catalog.",
      inputSchema: pluginInput,
      requiredCapabilities: ["halo.plugins.manage"],
      execute: async (input, context) =>
        execution(checkCapabilities(context, input.pluginId)),
    }),
    defineHaloTool({
      name: "grant",
      description:
        "Grant a plugin's currently declared tools that exist in the live Executor catalog.",
      inputSchema: pluginInput,
      requiredCapabilities: ["halo.plugins.manage"],
      execute: async (input, context) => {
        const checked = await checkCapabilities(context, input.pluginId);
        if (checked instanceof Error) return checked;
        const granted = await context.pluginToolGrants.grant({
          pluginId: input.pluginId,
          declaredPaths: checked.requested,
          grantPaths: checked.existing,
        });
        if (granted instanceof Error) return granted;
        return {
          value: {
            requested: checked.requested,
            existing: checked.existing,
            granted: granted.granted,
            newlyGranted: granted.added,
            missing: checked.missing,
          },
        };
      },
    }),
    defineHaloTool({
      name: "invoke",
      description: "Invoke a non-streaming Halo plugin server procedure.",
      inputSchema: invokeInput,
      requiredCapabilities: ["halo.plugins.manage"],
      execute: invokePlugin,
    }),
  ],
};

async function checkCapabilities(context: HaloToolContext, pluginId: string) {
  const manifest = await context.plugins.getManifest(pluginId);
  if (manifest instanceof Error) return manifest;
  const requested =
    manifest.halo.capabilities === undefined ? [] : manifest.halo.capabilities;
  const reconciled = await context.pluginToolGrants.reconcile({
    pluginId,
    declaredPaths: requested,
  });
  if (reconciled instanceof Error) return reconciled;
  const catalog = await context.runtime.listToolPaths();
  if (catalog instanceof Error) return catalog;
  const catalogPaths = new Set(catalog);
  return {
    requested,
    existing: requested.filter((path) => catalogPaths.has(path)),
    granted: reconciled.granted,
    missing: requested.filter((path) => !catalogPaths.has(path)),
  };
}

async function invokePlugin(
  input: {
    pluginId: string;
    path: string[];
    input?: unknown;
  },
  context: HaloToolContext,
) {
  const manifest = await context.plugins.getManifest(input.pluginId);
  if (manifest instanceof Error) return manifest;
  const declaredPaths =
    manifest.halo.capabilities === undefined ? [] : manifest.halo.capabilities;
  const tools = createPluginToolsFacade({
    authorize: (path) =>
      context.pluginToolGrants.authorize({
        pluginId: input.pluginId,
        declaredPaths,
        path,
      }),
    invoke: (path, toolInput) =>
      context.runtime.invokePath({
        path,
        args: toolInput,
        signal: context.signal,
      }),
  });
  const result = await context.plugins.invoke({
    pluginId: input.pluginId,
    path: input.path,
    input: input.input,
    signal: context.signal,
    tools,
  });
  if (result instanceof Error) return result;
  if (
    result instanceof Object &&
    Symbol.asyncIterator in result &&
    isCallable({ value: result[Symbol.asyncIterator] })
  ) {
    const error = new PluginToolStreamingUnsupportedError();
    return {
      value: {
        ok: false,
        error: { code: error.name, message: error.message },
      },
    };
  }
  return { value: result };
}

async function execution<T>(resultPromise: Promise<T | Error>) {
  const result = await resultPromise;
  if (result instanceof Error) return result;
  return { value: result } satisfies HaloToolExecution;
}
