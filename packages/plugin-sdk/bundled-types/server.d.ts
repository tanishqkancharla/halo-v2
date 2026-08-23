export type PluginServerContext = {
  pluginId: string;
  workspaceRoot: string;
};

type PluginHandler<T> = (args: {
  context: PluginServerContext;
}) => T | Promise<T>;

export const pluginOs: {
  handler: <T>(fn: PluginHandler<T>) => unknown;
};

export const os: typeof pluginOs;

export function type<T>(): unknown;
