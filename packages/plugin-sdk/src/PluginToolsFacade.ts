export type PluginToolResult =
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

export type PluginToolValue =
  | string
  | number
  | boolean
  | PluginToolInput
  | readonly PluginToolValue[]
  | null;

export type PluginToolInput = {
  readonly [key: string]: PluginToolValue;
};

export type PluginToolsFacade = {
  readonly [segment: string]: PluginToolsFacade;
} & ((input: PluginToolInput) => Promise<PluginToolResult>);

type PluginToolsFacadeOptions = {
  authorize: (path: string) => Promise<boolean | Error>;
  invoke: (
    path: string,
    input: PluginToolInput,
  ) => Promise<PluginToolResult | Error>;
};

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
    const authorized = await options.authorize(path);
    if (authorized instanceof Error) {
      return failure("tool_authorization_failed", "Tool authorization failed.");
    }
    if (!authorized) {
      return failure(
        "tool_not_granted",
        `Plugin is not granted tool '${path}'.`,
      );
    }
    // SAFETY: PluginToolsFacade's callable input contract guarantees PluginToolInput.
    const input = args[0] as PluginToolInput;
    const result = await options.invoke(path, input);
    if (result instanceof Error) {
      return failure("tool_invocation_failed", "Tool invocation failed.");
    }
    return result;
  }
}

function failure(code: string, message: string): PluginToolResult {
  return { ok: false, error: { code, message } };
}
