export type PluginToolResult =
  | { ok: true; data: unknown }
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

export type PluginServerContext = {
  pluginId: string;
  workspaceRoot: string;
  tools: PluginToolsFacade;
};

type PluginHandler<T> = (args: {
  context: PluginServerContext;
}) => T | Promise<T>;

export const pluginOs: {
  handler: <T>(fn: PluginHandler<T>) => unknown;
};

export const os: typeof pluginOs;

export function type<T>(): unknown;

export function syncRoutes(tables: unknown): Record<string, unknown>;
