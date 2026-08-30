import type { ToolRuntime } from "../agent/runtime/ToolRuntime.js";
import type { PluginToolGrants } from "./PluginToolGrants.js";

type PluginToolResult =
  | {
      ok: true;
      data: unknown;
      http?: { status: number; headers: Record<string, string> };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        status?: number;
        details?: unknown;
        retryable?: boolean;
      };
    };

type PluginToolValue =
  | string
  | number
  | boolean
  | PluginToolInput
  | readonly PluginToolValue[]
  | null;

type PluginToolInput = {
  readonly [key: string]: PluginToolValue;
};

type PluginToolsFacade = {
  readonly [segment: string]: PluginToolsFacade;
} & ((input: PluginToolInput) => Promise<PluginToolResult>);

type PluginToolsFacadeOptions = {
  pluginId: string;
  declaredPaths: readonly string[];
  grants: PluginToolGrants;
  runtime: ToolRuntime;
  signal?: AbortSignal;
};

// oxlint-disable-next-line anti-slop/no-unused-exports -- Phase 4 injects this proxy into plugin handlers.
export function createPluginToolsFacade(
  options: PluginToolsFacadeOptions,
): PluginToolsFacade {
  return proxy([]);

  function proxy(segments: readonly string[]): PluginToolsFacade {
    const target = (input: PluginToolInput) =>
      invoke(segments.join("."), [input]);
    // SAFETY: target supplies the call signature and get supplies the recursive string index.
    return new Proxy(target, {
      get(_target, property) {
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Proxy property keys are string | symbol.
        if (property === "then" || typeof property === "symbol")
          return undefined;
        return proxy([...segments, property]);
      },
      apply(_target, _thisArgument, args) {
        return invoke(segments.join("."), args);
      },
    }) as PluginToolsFacade;
  }

  async function invoke(
    path: string,
    args: unknown[],
  ): Promise<PluginToolResult> {
    if (path.length === 0 || args.length !== 1) {
      return failure(
        "invalid_tool_arguments",
        "Plugin tools accept one object argument.",
      );
    }
    const authorized = await options.grants.authorize({
      pluginId: options.pluginId,
      declaredPaths: options.declaredPaths,
      path,
    });
    if (authorized instanceof Error) {
      return failure("tool_authorization_failed", "Tool authorization failed.");
    }
    if (!authorized) {
      return failure(
        "tool_not_granted",
        `Plugin '${options.pluginId}' is not granted tool '${path}'.`,
      );
    }
    const result = await options.runtime.invokePath({
      path,
      args: args[0],
      signal: options.signal,
    });
    if (result instanceof Error) {
      return failure("tool_invocation_failed", "Tool invocation failed.");
    }
    return result;
  }
}

function failure(code: string, message: string): PluginToolResult {
  return { ok: false, error: { code, message } };
}
